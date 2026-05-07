import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";

type JobRow = {
  jobId: number;
  creator: string;
  dataRootHash: string;
  rewardPerTask: string;
  taskCount: number;
  approvedCount: number;
  dataType: number;
  active: boolean;
  txHash: string;
  // fetched from 0G Storage
  name?: string;
  instructions?: string;
  labels?: string[];
  previewImage?: string; // base64 data URL of first image
};

type Filter = "all" | "image" | "text" | "open" | "closed";

export default function Jobs() {
  const navigate = useNavigate();
  const { signer, isCorrectChain } = useWallet();
  const market = useAnnotationMarket(signer);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!market) return;
    loadJobs();
  }, [!!market]);

  async function loadJobs() {
    if (!market) return;
    setLoading(true);
    try {
      const events = await market.listJobs();
      const withState = await Promise.all(
        events.map(async (e) => {
          const j = await market.getJob(e.jobId);
          const base: JobRow = { ...e, approvedCount: Number(j.approvedCount), active: j.active };

          // Fetch metadata from 0G Storage (non-blocking — don't fail if unavailable)
          try {
            const metaRes = await fetch(`https://indexer-storage-testnet-turbo.0g.ai/file?root=${j.metadataURI}`, { signal: AbortSignal.timeout(5000) });
            if (metaRes.ok) {
              const meta = await metaRes.json();
              base.name = meta.name;
              base.instructions = meta.instructions;
              base.labels = meta.labels;

              // Fetch first image as preview (image jobs only)
              if (Number(j.dataType) === 0 && meta.dataRootHash) {
                const dataRes = await fetch(`https://indexer-storage-testnet-turbo.0g.ai/file?root=${meta.dataRootHash}`, { signal: AbortSignal.timeout(5000) });
                if (dataRes.ok) {
                  const files = await dataRes.json();
                  if (files?.[0]?.data && files[0].type) {
                    base.previewImage = `data:${files[0].type};base64,${files[0].data}`;
                  }
                }
              }
            }
          } catch { /* metadata fetch failed — show fallback */ }

          return base;
        })
      );
      setJobs(withState.reverse());
    } finally {
      setLoading(false);
    }
  }

  const filtered = jobs.filter((j) => {
    if (filter === "image") return j.dataType === 0;
    if (filter === "text") return j.dataType === 1;
    if (filter === "open") return j.active;
    if (filter === "closed") return !j.active;
    return true;
  });

  const openCount = jobs.filter((j) => j.active).length;

  return (
    <>
      {/* Hero */}
      <section style={{
        padding: "40px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 12 }}>
            <span style={{ color: "var(--primary)" }}>Find annotation jobs.</span>{" "}
            <span style={{ color: "var(--text)" }}>Get paid instantly.</span>
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: 14, maxWidth: 520 }}>
            Browse {openCount} open jobs across image and text datasets. Contribute high-quality labels to decentralized AI models.
          </p>
        </div>
        {/* Decorative grid */}
        <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "30%", opacity: 0.07, pointerEvents: "none", display: "flex", flexWrap: "wrap", gap: 4, padding: 16 }}>
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} style={{ width: 48, height: 48, border: "1px solid var(--primary)", background: i === 2 ? "var(--primary)" : "transparent" }} />
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <section style={{
        position: "sticky", top: 64, zIndex: 40,
        background: "var(--surface-low)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
      }}>
        <div className="filter-bar">
          {(["all", "image", "text"] as Filter[]).map((f) => (
            <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "image" ? "Image" : "Text"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="label-caps">Status:</span>
            <div style={{ display: "flex", background: "var(--surface-high)", border: "1px solid var(--border)", borderRadius: 4, padding: 4, gap: 4 }}>
              {(["open", "closed"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(filter === f ? "all" : f)}
                  style={{
                    padding: "2px 10px", borderRadius: 2, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    background: filter === f ? "rgba(0,228,121,0.2)" : "transparent",
                    color: filter === f ? "var(--primary)" : "var(--text-2)",
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => { loadJobs(); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>
        </div>
      </section>

      {/* Grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {!signer && (
          <p className="hint" style={{ textAlign: "center", padding: "48px 0" }}>
            Connect your wallet using the button in the top-right corner.
          </p>
        )}
        {signer && !isCorrectChain && (
          <p style={{ textAlign: "center", padding: "48px 0", color: "var(--error)", fontSize: 13 }}>
            Please switch to Galileo Testnet (Chain ID 16602) in your wallet.
          </p>
        )}
        {loading && <p className="hint" style={{ textAlign: "center", padding: "48px 0" }}>Loading jobs from chain…</p>}
        {!loading && filtered.length === 0 && signer && isCorrectChain && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <p style={{ color: "var(--text-2)", marginBottom: 12 }}>No jobs found.</p>
            <a href="/create" className="btn-primary">Create the first job</a>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {filtered.map((job) => (
            <div key={job.jobId} className={`job-card ${!job.active ? "closed" : ""}`}>
              {/* Header */}
              <div className="job-card-header">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div className="job-card-icon">
                    <span className="material-symbols-outlined">{job.dataType === 0 ? "image" : "article"}</span>
                  </div>
                  <div>
                    <div className="job-card-title">
                      {job.name || `Job #${job.jobId}`}
                    </div>
                    <div className="job-card-version">
                      {job.dataType === 0 ? "Image" : "Text"} · {job.taskCount} tasks
                      {job.labels && job.labels.length > 0 && ` · ${job.labels.slice(0, 3).join(", ")}${job.labels.length > 3 ? "…" : ""}`}
                    </div>
                  </div>
                </div>
                <span className={`badge ${job.active ? "badge-open" : "badge-closed"}`}>
                  {job.active ? "Open" : "Closed"}
                </span>
              </div>

              {/* Preview */}
              <div className="job-card-preview" style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {job.previewImage ? (
                  <img src={job.previewImage} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : job.instructions ? (
                  <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-2)", fontStyle: "italic", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                    "{job.instructions}"
                  </div>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--border)" }}>
                    {job.dataType === 0 ? "image" : "article"}
                  </span>
                )}
              </div>

              {/* Progress */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="label-caps">Progress</span>
                  <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--text)" }}>
                    {job.approvedCount} / {job.taskCount} tasks
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (job.approvedCount / job.taskCount) * 100)}%` }} />
                </div>
              </div>

              {/* Footer */}
              <div className="job-card-footer">
                <div>
                  <div className="reward-label">Reward</div>
                  <div className="reward-value">{job.rewardPerTask} 0G / task</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="reward-label">Creator</div>
                  <div className="mono-tag">{job.creator.slice(0, 6)}…{job.creator.slice(-4)}</div>
                </div>
              </div>

              {job.active ? (
                <button className="btn-secondary" style={{ width: "100%", justifyContent: "center", borderColor: "var(--primary)", color: "var(--primary)" }}
                  onClick={async () => {
                    if (!market) { navigate(`/jobs/${job.jobId}/0`); return; }
                    // Find first available (unclaimed or expired) task
                    for (let i = 0; i < job.taskCount; i++) {
                      const available = await market.isTaskAvailable(job.jobId, i).catch(() => true);
                      if (available) { navigate(`/jobs/${job.jobId}/${i}`); return; }
                    }
                    alert('All tasks are currently claimed. Try again in 30 minutes.');
                  }}>
                  Accept Work
                </button>
              ) : (
                <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }} disabled>
                  Task Completed
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
