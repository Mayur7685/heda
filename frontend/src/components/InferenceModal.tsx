import { useState } from "react";

const AI_SERVICE_API = import.meta.env.VITE_AI_SERVICE_API ?? "http://localhost:8000";

interface DetectedBox {
  x_min: number; // 0..100 percentage
  y_min: number;
  x_max: number;
  y_max: number;
  label: string;
  confidence: number;
}

interface InferenceResult {
  latencyMs: number;
  boxes: DetectedBox[];
}

interface Props {
  model: {
    modelId: number;
    modelType: number;
    weightsRootHash: string;
    metrics?: { map50?: number };
  };
  onClose: () => void;
}

export default function InferenceModal({ model, onClose }: Props) {
  const [testImage, setTestImage] = useState<string | null>(null);
  const [inferring, setInferring] = useState(false);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setTestImage(evt.target.result as string);
        setResult(null);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function runInference() {
    if (!testImage) return;
    setInferring(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      // Call local backend FastAPI Python AI service
      const res = await fetch(`${AI_SERVICE_API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: testImage,
          weightsRootHash: model.weightsRootHash,
          modelType: "YOLOv8n",
          labels: (model as any).labels ?? [],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`AI Service Error (${res.status}): ${errText || "Ensure python main.py is running in backend/ai-service"}`);
      }

      const data = await res.json();
      const endTime = performance.now();

      setResult({
        latencyMs: Math.round(endTime - startTime),
        boxes: data.boxes ?? [],
      });
    } catch (err: any) {
      setError(err.message || "Failed to connect to local AI service on http://localhost:8000");
    } finally {
      setInferring(false);
    }
  }

  const COLORS = ["#00e479", "#60a5fa", "#ffd700", "#ff69b4", "#7fff00", "#ff4444"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        maxWidth: 850, width: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 22 }}>
              bolt
            </span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Live Trained YOLO Model Test</h3>
              <span className="hint" style={{ fontSize: 11 }}>
                Model #{model.modelId} • Weights Root: <code>{model.weightsRootHash.slice(0, 12)}…</code>
              </span>
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Custom Image Upload Selector */}
          <div>
            <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>
              Select Image From Computer
            </label>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px 20px", border: "2px dashed var(--primary)", borderRadius: 8,
              background: testImage ? "var(--primary-bg)" : "rgba(0,228,121,0.04)",
              color: "var(--primary)", fontWeight: 700, fontSize: 13, cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>upload_file</span>
              {testImage ? "Click to change image file" : "Upload Test Image (PNG, JPG, WEBP)"}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
            </label>
          </div>

          {/* Canvas Preview Area with Bounding Box Overlays */}
          <div style={{
            position: "relative", width: "100%", height: 380, background: "#060a07",
            borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--border)",
          }}>
            {testImage ? (
              <img
                src={testImage}
                alt="Inference Target"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-3)", padding: 32 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 12 }}>
                  image_search
                </span>
                <p style={{ margin: 0, fontSize: 14 }}>Upload an image above to test your trained model</p>
              </div>
            )}

            {/* Live Bounding Box Overlays from PyTorch inference */}
            {testImage && result && result.boxes.map((box, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${box.x_min}%`,
                    top: `${box.y_min}%`,
                    width: `${box.x_max - box.x_min}%`,
                    height: `${box.y_max - box.y_min}%`,
                    border: `2px solid ${color}`,
                    background: `${color}15`,
                    pointerEvents: "none",
                    boxShadow: `0 0 10px ${color}44`,
                  }}
                >
                  <span style={{
                    position: "absolute", top: -20, left: 0,
                    background: color, color: "#000", fontSize: 11, fontWeight: 800,
                    padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap",
                    fontFamily: "'Space Grotesk', monospace",
                  }}>
                    {box.label} · {Math.round(box.confidence * 100)}%
                  </span>
                </div>
              );
            })}

            {inferring && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
              }}>
                <span className="material-symbols-outlined spinning" style={{ fontSize: 36, color: "var(--primary)" }}>
                  sync
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>
                  Executing Trained PyTorch Model Inference…
                </span>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              {result && (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: result.boxes.length > 0 ? "var(--primary)" : "var(--warn)" }}>
                    {result.boxes.length > 0 ? `✓ Detected ${result.boxes.length} objects` : "No objects detected"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "'Space Grotesk', monospace" }}>
                    Latency: {result.latencyMs}ms
                  </span>
                </div>
              )}
              {error && (
                <span style={{ fontSize: 12, color: "var(--error)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                  {error}
                </span>
              )}
            </div>

            <button
              className="btn-primary"
              onClick={runInference}
              disabled={inferring || !testImage}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
              {inferring ? "Running Model…" : "Run Live Inference"}
            </button>
          </div>

          {/* Predictions Table */}
          {result && result.boxes.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div className="label-caps" style={{ marginBottom: 8 }}>PyTorch Detection Predictions</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {result.boxes.map((b, i) => (
                  <div key={i} style={{
                    padding: "6px 12px", borderRadius: 4, background: "var(--surface-high)",
                    border: "1px solid var(--border)", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: COLORS[i % COLORS.length], flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{b.label}</span>
                    <span style={{ color: "var(--primary)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700 }}>
                      {Math.round(b.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
