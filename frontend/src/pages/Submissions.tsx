import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarketV2 } from "../hooks/useAnnotationMarketV2";
import { GALILEO } from "../config";

// status: "approved" | "pending" | "rejected" | "closed"
type Sub = {
  jobId: number; taskId: number;
  annotationRootHash: string;
  status: "approved" | "pending" | "rejected" | "closed";
  iouScore?: number;
  rewardShareBps?: number;
  rewardPerTask: string; txHash: string;
};

export default function Submissions() {
  const { signer, address } = useWallet();
  const marketV2 = useAnnotationMarketV2(signer);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalEarned, setTotalEarned] = useState("0.000");
  const loaded = useRef(false);

  useEffect(() => {
    if (!address || loaded.current) return;
    loaded.current = true;
    loadSubs();
  }, [address]);

  async function loadSubs() {
    if (!address) return;
    setLoading(true);
    const rows: Sub[] = [];
    let totalWei = 0n;

    // Cache job active states
    const jobActiveMap = new Map<number, boolean>();
    async function isJobActive(jId: number): Promise<boolean> {
      if (jobActiveMap.has(jId)) return jobActiveMap.get(jId)!;
      if (!marketV2) return true;
      try {
        const j = await marketV2.getJob(jId);
        jobActiveMap.set(jId, j.active);
        return j.active;
      } catch {
        return true;
      }
    }

    try {
      // 1. Fetch live V2 indexer submissions & onchain events
      const [indexerRes, onchainEvents] = await Promise.all([
        fetch(`http://localhost:3001/annotations/annotator/${address}`).then(r => r.ok ? r.json() : null).catch(() => null),
        marketV2 ? marketV2.listMySubmissions(address).catch(() => []) : [],
      ]);

      const onchainTxMap = new Map<string, string>();
      if (Array.isArray(onchainEvents)) {
        for (const ev of onchainEvents) {
          onchainTxMap.set(`${ev.jobId}:${ev.taskId}`, ev.txHash);
        }
      }

      if (Array.isArray(indexerRes?.submissions)) {
        for (const s of indexerRes.submissions) {
          const weiStr = s.reward_eth_wei || "0";
          const weiVal = BigInt(weiStr);
          if (s.status === "rewarded") totalWei += weiVal;

          const ethFormatted = weiVal > 0n ? `${ethers.formatEther(weiVal)} 0G` : (s.reward_share_bps ? `${(s.reward_share_bps / 100).toFixed(1)}% share` : "0%");
          const realTx = s.tx_hash || onchainTxMap.get(`${s.job_id}:${s.task_id}`) || "";
          const active = await isJobActive(s.job_id);

          let finalStatus: "approved" | "pending" | "rejected" | "closed" = "pending";
          if (s.status === "rewarded") {
            finalStatus = "approved";
          } else if (s.status === "rejected") {
            finalStatus = "rejected";
          } else if (s.status === "closed" || !active) {
            finalStatus = "closed";
          }

          rows.push({
            jobId: s.job_id,
            taskId: s.task_id,
            annotationRootHash: s.annotation_root_hash,
            status: finalStatus,
            iouScore: s.iou_score,
            rewardShareBps: s.reward_share_bps,
            rewardPerTask: ethFormatted,
            txHash: realTx,
          });
        }
      } else if (Array.isArray(onchainEvents) && onchainEvents.length > 0) {
        // Fallback directly from onchain events
        for (const ev of onchainEvents) {
          const active = await isJobActive(ev.jobId);
          rows.push({
            jobId: ev.jobId,
            taskId: ev.taskId,
            annotationRootHash: ev.annotationRootHash,
            status: active ? "pending" : "closed",
            rewardPerTask: active ? "Pending Eval" : "0G (Archived)",
            txHash: ev.txHash,
          });
        }
      }
    } catch (e) {
      console.warn("V2 annotator fetch note:", e);
    }

    setSubs(rows.reverse());
    setTotalEarned(parseFloat(ethers.formatEther(totalWei)).toFixed(4));
    setLoading(false);
  }

  const approved  = subs.filter((s) => s.status === "approved").length;
  const pending   = subs.filter((s) => s.status === "pending").length;
  const rejected  = subs.filter((s) => s.status === "rejected").length;
  const closed    = subs.filter((s) => s.status === "closed").length;

  const STATUS_BADGE: Record<Sub["status"], { label: string; style: React.CSSProperties }> = {
    approved: {
      label: "REWARDED",
      style: { background: "rgba(0,228,121,0.12)", color: "var(--primary)", border: "1px solid rgba(0,228,121,0.35)", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
    },
    pending: {
      label: "PENDING",
      style: { background: "rgba(255,219,121,0.10)", color: "var(--warn)", border: "1px solid rgba(255,219,121,0.3)", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
    },
    rejected: {
      label: "REJECTED",
      style: { background: "rgba(255,68,68,0.10)", color: "var(--error)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
    },
    closed: {
      label: "JOB ARCHIVED",
      style: { background: "rgba(148,163,184,0.12)", color: "var(--text-3)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
    },
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>My Work</h1>
          <p style={{ color: "var(--text-2)", fontSize: 14 }}>Your annotation history and earnings.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => { loaded.current = false; loadSubs(); }} disabled={loading}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, margin: "24px 0" }}>
        <div className="stat-card highlight">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value green">
            {totalEarned}
            <span className="stat-unit">0G ETH</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tasks Submitted</div>
          <div className="stat-value">{subs.length.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rewarded</div>
          <div className="stat-value" style={{ color: "var(--primary)" }}>{approved.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Eval</div>
          <div className="stat-value" style={{ color: "var(--warn)" }}>{pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Job Archived</div>
          <div className="stat-value" style={{ color: "var(--text-3)" }}>{closed}</div>
        </div>
      </div>

      {loading && <p className="hint" style={{ textAlign: "center", padding: "32px 0" }}>Loading submissions from chain…</p>}

      {!loading && subs.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-3)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 12 }}>history</span>
          <p>No submissions yet. <a href="/">Pick up a job</a></p>
        </div>
      )}

      {subs.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Task #</th>
                <th>IoU Quality</th>
                <th>Reward Share</th>
                <th>Status</th>
                <th>0G Storage File</th>
                <th>On-Chain Tx</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => {
                const badge = STATUS_BADGE[s.status];
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>Job #{s.jobId}</td>
                    <td style={{ fontFamily: "'Space Grotesk', monospace" }}>#{s.taskId + 1}</td>
                    <td style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: s.iouScore && s.iouScore >= 0.5 ? "var(--primary)" : "var(--text-2)" }}>
                      {s.iouScore !== undefined && s.iouScore !== null ? `${(s.iouScore * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ fontFamily: "'Space Grotesk', monospace", color: s.status === "approved" ? "var(--primary)" : "var(--text-3)", fontWeight: 600 }}>
                      {s.rewardPerTask}
                    </td>
                    <td>
                      <span style={badge.style}>{badge.label}</span>
                    </td>
                    <td>
                      {s.annotationRootHash ? (
                        <a
                          href={`${GALILEO.storageExplorer}/file/${s.annotationRootHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mono-tag"
                          style={{ color: "var(--primary)", textDecoration: "none" }}
                          title="View on 0G Storage Explorer"
                        >
                          {s.annotationRootHash.slice(0, 8)}…{s.annotationRootHash.slice(-4)} ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-3)", fontSize: 12, fontStyle: "italic" }}>Awaiting Conf.</span>
                      )}
                    </td>
                    <td>
                      {s.txHash ? (
                        <a
                          href={`${GALILEO.explorer}/tx/${s.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mono-tag"
                          style={{ color: "#60a5fa", textDecoration: "none" }}
                          title="View on 0G Chain Explorer"
                        >
                          {s.txHash.slice(0, 6)}…{s.txHash.slice(-4)} ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="hint">Showing 1–{subs.length} of {subs.length} submissions</span>
            {rejected > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                💡 Rejected tasks are reopened — you can re-annotate them from the <a href="/">Jobs</a> page.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

