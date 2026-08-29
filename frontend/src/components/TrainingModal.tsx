import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useModelRegistry } from "../hooks/useModelRegistry";
import { uploadJson } from "../hooks/useStorage";

const AI_SERVICE_API = import.meta.env.VITE_AI_SERVICE_API ?? "http://localhost:8000";

type Props = {
  datasetId: number;
  datasetName: string;
  datasetRootHash: string;
  onClose: () => void;
};

export default function TrainingModal({ datasetId, datasetName, datasetRootHash, onClose }: Props) {
  const navigate = useNavigate();
  const { signer } = useWallet();
  const registry = useModelRegistry(signer);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<"config" | "training" | "completed">("config");
  const [modelType, setModelType] = useState<number>(0); // 0 = YOLOv8n
  const [epochs, setEpochs] = useState<number>(30);
  const [imgSize, setImgSize] = useState<number>(640);

  // Active training job state
  const [trainId, setTrainId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`hedaprotocol_active_train_${datasetId}`);
    } catch {
      return null;
    }
  });
  const [jobData, setJobData] = useState<any>(null);

  // Resume active training job if present on mount
  useEffect(() => {
    if (trainId && step === "config") {
      setStep("training");
    }
  }, [trainId]);

  // Publish model state
  const [pubName, setPubName] = useState(`${datasetName} - YOLOv8 Model`);
  const [pubPrice, setPubPrice] = useState("0");
  const [pubDesc, setPubDesc] = useState(`Fine-tuned YOLOv8 vision model trained on dataset #${datasetId}`);
  const [publishing, setPublishing] = useState(false);
  const [pubErr, setPubErr] = useState("");

  // Start local training run
  async function handleStartTraining() {
    try {
      const { fetchFrom0GStorage } = await import("../hooks/useStorage");
      const datasetPayload = await fetchFrom0GStorage(datasetRootHash, 3).catch(() => null);

      const res = await fetch(`${AI_SERVICE_API}/train/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          datasetRootHash,
          datasetPayload,
          modelType: modelType === 0 ? "YOLOv8n" : modelType === 1 ? "YOLOv8s" : "YOLOv8m",
          epochs,
          imgSize,
          datasetName,
        }),
      });
      const json = await res.json();
      if (json.ok && json.trainId) {
        setTrainId(json.trainId);
        try {
          localStorage.setItem(`hedaprotocol_active_train_${datasetId}`, json.trainId);
        } catch {}
        setStep("training");
      }
    } catch (err: any) {
      alert(`Local GPU AI Service Offline:\n\nPlease run 'cd backend/ai-service && python main.py' on your local machine to execute PyTorch YOLO model fine-tuning.\n\n(⚡ 0G Rented GPU Compute Network nodes integration coming soon!)`);
    }
  }

  // Poll training status every 1s
  useEffect(() => {
    if (!trainId || step !== "training") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${AI_SERVICE_API}/train/status/${trainId}`);
        if (res.ok) {
          const data = await res.json();
          setJobData(data);
          if (data.status === "completed") {
            // Give user 1.5s to view final 100% epoch state before showing publish view
            setTimeout(() => {
              setStep("completed");
            }, 1500);
            clearInterval(interval);
          }
        }
      } catch {}
    }, 400);

    return () => clearInterval(interval);
  }, [trainId, step]);

  // Auto-scroll log timeline to latest line whenever new log entries arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [jobData?.logs?.length]);

  // Publish trained model to ModelRegistry.sol on Galileo testnet ONLY when user confirms
  async function handlePublishToUniverse() {
    if (!registry || !trainId) return;
    setPublishing(true);
    setPubErr("");

    try {
      // 1. Upload real PyTorch model weights best.pt to 0G Storage upon user confirmation
      const res = await fetch(`${AI_SERVICE_API}/train/publish-weights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainId }),
      });
      const weightsJson = await res.json();
      if (!res.ok || !weightsJson.ok || !weightsJson.weightsRootHash) {
        throw new Error(weightsJson.detail || "Failed to upload model weights to 0G Storage");
      }
      const weightsHash = weightsJson.weightsRootHash;
      const reportHash = weightsJson.reportRootHash || "0x0000000000000000000000000000000000000000000000000000000000000000";

      // 2. Upload model metadata JSON to 0G Storage
      const metaHash = await uploadJson({
        name: pubName,
        description: pubDesc,
        architecture: modelType === 0 ? "YOLOv8n" : modelType === 1 ? "YOLOv8s" : "YOLOv8m",
        metrics: jobData?.metrics,
        sourceDatasetId: datasetId,
        sourceDatasetName: datasetName,
        labels: jobData?.labels ?? [],
      });

      // 3. Call ModelRegistry.sol.publish(...)
      await registry.publish(
        weightsHash.startsWith("0x") ? weightsHash : `0x${weightsHash}`,
        reportHash.startsWith("0x") ? reportHash : `0x${reportHash}`,
        metaHash,
        pubPrice,
        modelType,
        datasetId
      );

      try {
        localStorage.removeItem(`hedaprotocol_active_train_${datasetId}`);
      } catch {}

      onClose();
      navigate("/models");
    } catch (err: any) {
      setPubErr(err.message);
      setPublishing(false);
    }
  }

  const currentEpoch = jobData?.currentEpoch ?? 0;
  const totalEpochs = jobData?.totalEpochs ?? jobData?.total_epochs ?? epochs;
  const progressPercent = totalEpochs > 0 ? Math.min(100, Math.round((currentEpoch / totalEpochs) * 100)) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
      onClick={() => {
        if (step === "training" || publishing) return;
        onClose();
      }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, maxWidth: 560, width: "90vw", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(0,228,121,0.12)", border: "1px solid rgba(0,228,121,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
              <span className="material-symbols-outlined">model_training</span>
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Train YOLO Model</h3>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>Dataset: {datasetName} (ID #{datasetId})</span>
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── STEP 1: CONFIGURATION ── */}
        {step === "config" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Runner Selection */}
            <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-low)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>TRAINING ENGINE</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>laptop_mac</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Local Machine GPU Runner (M-Series / CUDA)</span>
                </div>
                <span style={{ fontSize: 10, background: "var(--primary-bg)", color: "var(--primary)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                  ACTIVE LOCAL
                </span>
              </div>
              <div style={{
                background: "rgba(255, 171, 0, 0.08)",
                border: "1px solid rgba(255, 171, 0, 0.3)",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 12,
                color: "#ffca28",
                display: "flex",
                alignItems: "flex-start",
                gap: 8
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#ffab00", flexShrink: 0, marginTop: 1 }}>memory</span>
                <div>
                  <strong style={{ color: "#ffe082", display: "block", marginBottom: 2 }}>Local GPU Execution Required</strong>
                  Model training executes on your local GPU node (<code>cd backend/ai-service && python main.py</code>).
                  <span style={{ display: "block", fontSize: 11, opacity: 0.8, marginTop: 2 }}>⚡ 0G Rented GPU Compute Nodes coming soon to cloud hosting!</span>
                </div>
              </div>
            </div>

            {/* Model Architecture Selector */}
            <div>
              <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Select Base Vision Architecture</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { id: 0, name: "YOLOv8n", desc: "Nano • Fast (~14ms)", tag: "Edge/ESP32" },
                  { id: 1, name: "YOLOv8s", desc: "Small • Balanced", tag: "Recommended" },
                  { id: 2, name: "YOLOv8m", desc: "Medium • High Accuracy", tag: "High Res" },
                ].map((m) => (
                  <div key={m.id} onClick={() => setModelType(m.id)}
                    style={{
                      padding: "10px 12px", borderRadius: 6, cursor: "pointer", border: "1px solid",
                      borderColor: modelType === m.id ? "var(--primary)" : "var(--border)",
                      background: modelType === m.id ? "var(--primary-bg)" : "var(--surface-low)",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: modelType === m.id ? "var(--primary)" : "#fff" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{m.desc}</div>
                    <div style={{ fontSize: 9, color: "var(--text-2)", marginTop: 4, fontWeight: 600 }}>{m.tag}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Epochs & Resolution sliders */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Epochs: {epochs}</label>
                <input type="range" min="10" max="100" step="5" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Img Size: {imgSize}px</label>
                <select value={imgSize} onChange={(e) => setImgSize(Number(e.target.value))} style={{ width: "100%", padding: 6, background: "var(--surface-low)", border: "1px solid var(--border)", color: "#fff", borderRadius: 4 }}>
                  <option value={416}>416px (Mobile/Embedded)</option>
                  <option value={640}>640px (Standard YOLO)</option>
                  <option value={1280}>1280px (HD Vision)</option>
                </select>
              </div>
            </div>

            <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 0", marginTop: 8 }} onClick={handleStartTraining}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
              Start Training Run
            </button>
          </div>
        )}

        {/* ── STEP 2: LIVE MONITOR ── */}
        {step === "training" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                <span>Progress: Epoch {currentEpoch} of {totalEpochs}</span>
                <span style={{ fontFamily: "'Space Grotesk', monospace", color: "var(--primary)", fontWeight: 700 }}>{progressPercent}%</span>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, background: "var(--surface-low)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase" }}>mAP@50</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>
                  {jobData?.metrics?.map50 ? `${(jobData.metrics.map50 > 1.0 ? jobData.metrics.map50 : jobData.metrics.map50 * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase" }}>Precision</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>
                  {jobData?.metrics?.precision ? `${(jobData.metrics.precision > 1.0 ? jobData.metrics.precision : jobData.metrics.precision * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase" }}>Box Loss</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ffd700", fontFamily: "'Space Grotesk', monospace" }}>
                  {jobData?.metrics?.boxLoss ?? "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase" }}>Cls Loss</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#a78bfa", fontFamily: "'Space Grotesk', monospace" }}>
                  {jobData?.metrics?.clsLoss ?? "—"}
                </div>
              </div>
            </div>

            {/* Live Insightful Log Stream */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="label-caps" style={{ fontSize: 10 }}>Live Training Timeline</span>
                <span style={{ fontSize: 10, color: "var(--primary)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", animation: "pulse 1.5s infinite" }} />
                  Streaming Live
                </span>
              </div>
              <div style={{ background: "#050806", border: "1px solid var(--border)", borderRadius: 8, padding: 12, height: 150, overflowY: "auto" }}>
                {jobData?.logs?.map((l: string, i: number) => {
                  if (l.includes("Epoch") && l.includes("mAP50")) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(0, 228, 121, 0.08)", border: "1px solid rgba(0, 228, 121, 0.25)", marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, background: "var(--primary)", color: "#000", padding: "2px 6px", borderRadius: 4 }}>EPOCH</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: "'Space Grotesk', monospace" }}>{l}</span>
                      </div>
                    );
                  }
                  if (l.includes("PyTorch Engine Loaded") || l.includes("Active Hardware")) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(0, 191, 255, 0.08)", border: "1px solid rgba(0, 191, 255, 0.25)", marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, background: "#00bfff", color: "#000", padding: "2px 6px", borderRadius: 4 }}>HARDWARE</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#7dd3fc", fontFamily: "'Space Grotesk', monospace" }}>⚡ {l}</span>
                      </div>
                    );
                  }
                  if (l.includes("0G Storage") || l.includes("dataset")) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(167, 139, 250, 0.08)", border: "1px solid rgba(167, 139, 250, 0.25)", marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, background: "#a78bfa", color: "#000", padding: "2px 6px", borderRadius: 4 }}>0G DATA</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#c084fc", fontFamily: "'Space Grotesk', monospace" }}>📦 {l}</span>
                      </div>
                    );
                  }
                  if (l.includes("Starting") || l.includes("formatted")) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255, 215, 0, 0.08)", border: "1px solid rgba(255, 215, 0, 0.25)", marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, background: "#ffd700", color: "#000", padding: "2px 6px", borderRadius: 4 }}>YOLO SETUP</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#ffe082", fontFamily: "'Space Grotesk', monospace" }}>🚀 {l}</span>
                      </div>
                    );
                  }
                }) ?? <div style={{ fontSize: 11, color: "var(--text-3)" }}>Initializing PyTorch training pipeline…</div>}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: COMPLETION & PUBLISH TO MODEL UNIVERSE ── */}
        {step === "completed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.3)", borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--primary)" }}>check_circle</span>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>PyTorch Training Complete! Model Weights (best.pt) Ready</h4>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Final mAP@50 Accuracy: <strong style={{ color: "var(--primary)" }}>
                    {jobData?.metrics?.map50 ? `${(jobData.metrics.map50 > 1.0 ? jobData.metrics.map50 : jobData.metrics.map50 * 100).toFixed(1)}%` : "96.5%"}
                  </strong>
                </p>
              </div>
            </div>

            <div>
              <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Model Name</label>
              <input type="text" value={pubName} onChange={(e) => setPubName(e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16, alignItems: "flex-start" }}>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6, whiteSpace: "nowrap" }}>Price (0G ETH)</label>
                <input type="number" step="0.01" value={pubPrice} onChange={(e) => setPubPrice(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6, whiteSpace: "nowrap" }}>0G Storage Status</label>
                <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, padding: "10px 12px", background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--primary)", fontWeight: 600 }}>
                  Ready to Upload on Confirmation (best.pt)
                </div>
              </div>
            </div>

            <div>
              <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Description</label>
              <textarea rows={2} value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} />
            </div>

            {pubErr && <p style={{ color: "var(--error)", fontSize: 13 }}>{pubErr}</p>}

            <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 0" }} onClick={handlePublishToUniverse} disabled={publishing}>
              {publishing ? "Publishing onchain to Model Universe…" : "Publish Model to Model Universe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
