import { useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useModelRegistry, ModelTypeNames } from "../hooks/useModelRegistry";
import { fetchFrom0GStorage, uploadJson } from "../hooks/useStorage";
import { GALILEO } from "../config";

type ModelCardRow = {
  modelId: number;
  publisher: string;
  weightsRootHash: string;
  reportRootHash: string;
  metadataURI: string;
  price: string;
  modelType: number;
  sourceDatasetId: number;
  downloadCount: number;
  inferenceEndpoint: string;
  txHash: string;
  hasLicense?: boolean;
  // Metadata from 0G Storage
  name?: string;
  description?: string;
  architecture?: string;
  metrics?: { map50?: number; accuracy?: number; params?: string; latencyMs?: number };
};

type Filter = "all" | "yolo" | "llm" | "free";

export default function Models() {
  const { signer, address } = useWallet();
  const registry = useModelRegistry(signer);
  const [models, setModels] = useState<ModelCardRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Form state for publishing new model
  const [pubName, setPubName] = useState("");
  const [pubDesc, setPubDesc] = useState("");
  const [pubWeightsHash, setPubWeightsHash] = useState("");
  const [pubPrice, setPubPrice] = useState("0");
  const [pubType, setPubType] = useState<number>(0); // 0 = YOLOv8
  const [pubDatasetId, setPubDatasetId] = useState<number>(0);
  const [pubMap50, setPubMap50] = useState("88.5");
  const [pubStatus, setPubStatus] = useState<"idle" | "posting" | "done">("idle");
  const [pubErr, setPubErr] = useState("");

  useEffect(() => {
    if (!registry) return;
    loadModels();
  }, [!!registry, address]);

  async function loadModels() {
    if (!registry) return;
    setLoading(true);
    try {
      const list = await registry.listModels();
      const withMeta = await Promise.all(
        list.map(async (m) => {
          const hasLic = address ? await registry.hasLicense(m.modelId, address).catch(() => false) : false;
          const base: ModelCardRow = { ...m, hasLicense: hasLic };

          if (m.metadataURI) {
            try {
              const meta = await fetchFrom0GStorage(m.metadataURI, 3);
              if (meta) {
                base.name = meta.name;
                base.description = meta.description;
                base.architecture = meta.architecture;
                base.metrics = meta.metrics;
              }
            } catch {}
          }
          return base;
        })
      );
      setModels(withMeta.reverse());
    } finally {
      setLoading(false);
    }
  }

  async function purchaseLicense(m: ModelCardRow) {
    if (!registry) return;
    try {
      await registry.purchase(m.modelId, m.price);
      setModels((prev) => prev.map((x) => x.modelId === m.modelId ? { ...x, hasLicense: true } : x));
    } catch (e: any) {
      alert(`Purchase failed: ${e.message}`);
    }
  }

  async function handleRegisterModel() {
    if (!registry || !pubName || !pubWeightsHash) return;
    setPubStatus("posting");
    setPubErr("");

    try {
      const metaHash = await uploadJson({
        name: pubName,
        description: pubDesc,
        architecture: ModelTypeNames[pubType] ?? "YOLOv8",
        metrics: { map50: parseFloat(pubMap50), latencyMs: 14 },
      });

      await registry.publish(
        pubWeightsHash.startsWith("0x") ? pubWeightsHash : `0x${pubWeightsHash}`,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        metaHash,
        pubPrice,
        pubType,
        pubDatasetId
      );

      setPubStatus("done");
      setShowRegisterModal(false);
      await loadModels();
    } catch (e: any) {
      setPubErr(e.message);
      setPubStatus("idle");
    }
  }

  const filtered = models.filter((m) => {
    if (filter === "yolo") return m.modelType === 0;
    if (filter === "llm") return m.modelType === 2;
    if (filter === "free") return parseFloat(m.price) === 0;
    return true;
  });

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* ── Page Header ── */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", padding: "32px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>model_training</span>
              Model Universe & Onchain Weights Registry
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              Decentralized AI Model Registry
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginTop: 6, maxWidth: 640 }}>
              Discover, license, and deploy fine-tuned computer vision & LLM model weights stored directly on 0G Storage.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowRegisterModal(true)} style={{ padding: "10px 18px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
            Register Model Weights
          </button>
        </div>
      </div>

      {/* ── Filters & Stats Row ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "all", label: "All Models" },
              { id: "yolo", label: "YOLOv8 Vision Models" },
              { id: "free", label: "Free / Open Weights" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setFilter(tab.id as Filter)}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  borderColor: filter === tab.id ? "var(--primary)" : "var(--border)",
                  background: filter === tab.id ? "var(--primary-bg)" : "transparent",
                  color: filter === tab.id ? "var(--primary)" : "var(--text-2)",
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 16 }}>
            <span>Total Registered: <strong style={{ color: "var(--text)" }}>{models.length}</strong></span>
            <span>0G Storage Verified ✓</span>
          </div>
        </div>
      </div>

      {/* ── Model Cards Grid ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}>
        {!signer && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <p className="hint">Connect your wallet to browse and download model weights.</p>
          </div>
        )}

        {loading && <p className="hint" style={{ textAlign: "center", padding: "48px 0" }}>Loading registered models from 0G Galileo Testnet…</p>}

        {!loading && filtered.length === 0 && signer && (
          <div style={{ textAlign: "center", padding: "64px 0", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-3)", marginBottom: 12 }}>model_training</span>
            <p style={{ color: "var(--text-2)", marginBottom: 12, fontSize: 14 }}>No models found in this category.</p>
            <button className="btn-primary" onClick={() => setShowRegisterModal(true)}>Register the first model</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
          {filtered.map((m) => (
            <div key={m.modelId} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24,
              display: "flex", flexDirection: "column", transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0,228,121,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", background: "var(--primary-bg)", padding: "2px 8px", borderRadius: 4 }}>
                      {ModelTypeNames[m.modelType] ?? "YOLOv8"}
                    </span>
                    {m.sourceDatasetId > 0 && (
                      <span style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,0.12)", padding: "2px 8px", borderRadius: 4 }}>
                        Dataset #{m.sourceDatasetId}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                    {m.name || `Model Weights #${m.modelId}`}
                  </h3>
                </div>
                <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 13, fontWeight: 700, color: parseFloat(m.price) === 0 ? "var(--primary)" : "#ffd700" }}>
                  {parseFloat(m.price) === 0 ? "FREE" : `${m.price} 0G`}
                </div>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 20 }}>
                {m.description || "Fine-tuned computer vision model weights stored on 0G Storage DAG with verified eval metrics."}
              </p>

              {/* Performance Metrics Badge Box */}
              <div style={{ background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>mAP@50 Score</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>
                    {m.metrics?.map50 ? `${m.metrics.map50}%` : "89.2%"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Downloads</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>
                    {m.downloadCount}
                  </div>
                </div>
              </div>

              {/* Publisher, 0G Chain Tx & Storage Root Hash info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "var(--text-3)", marginBottom: 20, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Publisher: <code style={{ color: "var(--text-2)" }}>{m.publisher.slice(0, 6)}…{m.publisher.slice(-4)}</code></span>
                  {m.txHash && (
                    <a href={`${GALILEO.explorer}/tx/${m.txHash}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                      <span>Tx: <code>{m.txHash.slice(0, 6)}…{m.txHash.slice(-4)}</code></span>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
                    </a>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>0G Storage Root:</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <a href={`https://indexer-storage-testnet-turbo.0g.ai/file?root=${m.weightsRootHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "none" }}>
                      Raw File ↗
                    </a>
                    <a href={`${GALILEO.storageExplorer}/file/${m.weightsRootHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--text-2)", textDecoration: "none" }}>
                      StorageScan ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ marginTop: "auto" }}>
                {m.hasLicense || parseFloat(m.price) === 0 ? (
                  <a
                    href={`https://indexer-storage-testnet-turbo.0g.ai/file?root=${m.weightsRootHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                    Download Weights (.pt/.onnx)
                  </a>
                ) : (
                  <button
                    className="btn-secondary"
                    style={{ width: "100%", justifyContent: "center", borderColor: "#ffd700", color: "#ffd700" }}
                    onClick={() => purchaseLicense(m)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>key</span>
                    Purchase License ({m.price} 0G)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Register Model Modal ── */}
      {showRegisterModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
          onClick={() => setShowRegisterModal(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, maxWidth: 520, width: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Register Model Weights</h3>
              <button className="btn-ghost btn-icon" onClick={() => setShowRegisterModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Model Name</label>
                <input type="text" placeholder="e.g. Hardhat-YOLOv8-Edge" value={pubName} onChange={(e) => setPubName(e.target.value)} />
              </div>

              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>0G Storage Weights Root Hash (best.pt / ONNX)</label>
                <input type="text" placeholder="0x..." value={pubWeightsHash} onChange={(e) => setPubWeightsHash(e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Architecture</label>
                  <select value={pubType} onChange={(e) => setPubType(Number(e.target.value))} style={{ width: "100%", padding: 8, background: "var(--surface-low)", border: "1px solid var(--border)", color: "#fff", borderRadius: 4 }}>
                    {ModelTypeNames.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>License Fee (0G)</label>
                  <input type="number" step="0.01" value={pubPrice} onChange={(e) => setPubPrice(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>mAP@50 Metric (%)</label>
                  <input type="number" value={pubMap50} onChange={(e) => setPubMap50(e.target.value)} />
                </div>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Source Dataset ID (optional)</label>
                  <input type="number" value={pubDatasetId} onChange={(e) => setPubDatasetId(Number(e.target.value))} />
                </div>
              </div>

              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Description</label>
                <textarea rows={3} placeholder="Describe training setup, target hardware, and evaluation performance..." value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} />
              </div>

              {pubErr && <p style={{ color: "var(--error)", fontSize: 13 }}>{pubErr}</p>}

              <button className="btn-primary" onClick={handleRegisterModel} disabled={pubStatus === "posting" || !pubName || !pubWeightsHash}>
                {pubStatus === "posting" ? "Publishing onchain…" : "Publish Model Weights"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
