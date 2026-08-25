import { useState, useEffect } from "react";
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

  const [step, setStep] = useState<"config" | "training" | "completed">("config");
  const [modelType, setModelType] = useState<number>(0); // 0 = YOLOv8n
  const [epochs, setEpochs] = useState<number>(30);
  const [imgSize, setImgSize] = useState<number>(640);

  // Active training job state
  const [trainId, setTrainId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<any>(null);

  // Publish model state
  const [pubName, setPubName] = useState(`${datasetName} - YOLOv8 Model`);
  const [pubPrice, setPubPrice] = useState("0");
  const [pubDesc, setPubDesc] = useState(`Fine-tuned YOLOv8 vision model trained on dataset #${datasetId}`);
  const [publishing, setPublishing] = useState(false);
  const [pubErr, setPubErr] = useState("");

  // Start local training run
  async function handleStartTraining() {
    try {
      const res = await fetch(`${AI_SERVICE_API}/train/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          datasetRootHash,
          modelType: modelType === 0 ? "YOLOv8n" : modelType === 1 ? "YOLOv8s" : "YOLOv8m",
          epochs,
          imgSize,
          datasetName,
        }),
      });
      const json = await res.json();
      if (json.ok && json.trainId) {
        setTrainId(json.trainId);
        setStep("training");
      }
    } catch (err: any) {
      alert(`Failed to start training: ${err.message}`);
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
            setStep("completed");
            clearInterval(interval);
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [trainId, step]);

  // Publish trained model to ModelRegistry.sol on Galileo testnet
  async function handlePublishToUniverse() {
    if (!registry || !jobData || !jobData.weightsRootHash) return;
    setPublishing(true);
    setPubErr("");

    try {
      // 1. Upload model metadata JSON to 0G Storage
      const metaHash = await uploadJson({
        name: pubName,
        description: pubDesc,
        architecture: modelType === 0 ? "YOLOv8n" : modelType === 1 ? "YOLOv8s" : "YOLOv8m",
        metrics: jobData.metrics,
        sourceDatasetId: datasetId,
      });

      // 2. Call ModelRegistry.sol.publish(...)
      await registry.publish(
        jobData.weightsRootHash.startsWith("0x") ? jobData.weightsRootHash : `0x${jobData.weightsRootHash}`,
        jobData.reportRootHash ? (jobData.reportRootHash.startsWith("0x") ? jobData.reportRootHash : `0x${jobData.reportRootHash}`) : "0x0000000000000000000000000000000000000000000000000000000000000000",
        metaHash,
        pubPrice,
        modelType,
        datasetId
      );

      onClose();
      navigate("/models");
    } catch (err: any) {
      setPubErr(err.message);
      setPublishing(false);
    }
  }

  const currentEpoch = jobData?.currentEpoch ?? 0;
  const progressPercent = Math.round((currentEpoch / epochs) * 100);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>laptop_mac</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Local Machine Runner (M-Series / CUDA)</span>
                </div>
                <span style={{ fontSize: 10, background: "var(--primary-bg)", color: "var(--primary)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                  ACTIVE
                </span>
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
                <span>Progress: Epoch {currentEpoch} of {epochs}</span>
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
                  {jobData?.metrics?.map50 ? `${(jobData.metrics.map50 * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase" }}>Precision</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>
                  {jobData?.metrics?.precision ? `${(jobData.metrics.precision * 100).toFixed(1)}%` : "—"}
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

            {/* Live Logs Terminal */}
            <div style={{ background: "#080c09", border: "1px solid var(--border)", borderRadius: 6, padding: 12, height: 120, overflowY: "auto", fontFamily: "'Space Grotesk', monospace", fontSize: 11, color: "var(--text-2)" }}>
              {jobData?.logs?.map((l: string, i: number) => (
                <div key={i} style={{ marginBottom: 2 }}>{l}</div>
              )) ?? <div>Initializing training environment…</div>}
            </div>
          </div>
        )}

        {/* ── STEP 3: COMPLETION & PUBLISH TO MODEL UNIVERSE ── */}
        {step === "completed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.3)", borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--primary)" }}>check_circle</span>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Training Complete & Weights Pinned to 0G Storage!</h4>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Final mAP@50 Accuracy: <strong style={{ color: "var(--primary)" }}>{(jobData?.metrics?.map50 * 100).toFixed(1)}%</strong>
                </p>
              </div>
            </div>

            <div>
              <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Model Name</label>
              <input type="text" value={pubName} onChange={(e) => setPubName(e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>License Price (0G)</label>
                <input type="number" step="0.01" value={pubPrice} onChange={(e) => setPubPrice(e.target.value)} />
              </div>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>0G Weights Root Hash</label>
                <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, padding: "8px 10px", background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {jobData?.weightsRootHash}
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
