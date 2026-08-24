import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";
import { GALILEO } from "../config";

// status: "approved" | "pending" | "rejected"
// The contract does `delete submissions[...]` on rejection, so sub.exists === false
// after a WorkSubmitted event means the creator rejected it.
type Sub = {
  jobId: number; taskId: number;
  annotationRootHash: string;
  status: "approved" | "pending" | "rejected";
  rewardPerTask: string; txHash: string;
};

export default function Submissions() {
  const { signer, address } = useWallet();
  const market = useAnnotationMarket(signer);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalEarned, setTotalEarned] = useState("0");
  const loaded = useRef(false);

  useEffect(() => {
    if (!market || !address || loaded.current) return;
    loaded.current = true;
    loadSubs();
  }, [!!market, address]);

  async function loadSubs() {
    if (!market || !address) return;
    setLoading(true);
    try {
      const events = await market.listMySubmissions(address);
      const rows: Sub[] = [];
      let earned = 0n;
      for (const e of events) {
        const job = await market.getJob(e.jobId);
        const sub = await market.getSubmission(e.jobId, e.taskId);

        // sub.exists === false means the creator deleted it via rejectWork()
        // sub.exists === true  && sub.approved === true  → approved
        // sub.exists === true  && sub.approved === false → pending review
        const status: "approved" | "pending" | "rejected" =
          !sub.exists ? "rejected"
          : sub.approved ? "approved"
          : "pending";

        rows.push({
          jobId: e.jobId,
          taskId: e.taskId,
          annotationRootHash: e.annotationRootHash,
          status,
          rewardPerTask: ethers.formatEther(job.rewardPerTask),
          txHash: e.txHash,
        });
        if (sub.approved) earned += BigInt(job.rewardPerTask);
      }
      setSubs(rows.reverse());
      setTotalEarned(ethers.formatEther(earned));
    } finally { setLoading(false); }
  }

  const approved  = subs.filter((s) => s.status === "approved").length;
  const pending   = subs.filter((s) => s.status === "pending").length;
  const rejected  = subs.filter((s) => s.status === "rejected").length;

  const STATUS_BADGE: Record<Sub["status"], { label: string; style: React.CSSProperties }> = {
    approved: {
      label: "APPROVED",
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
            <span className="stat-unit">0G</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tasks Submitted</div>
          <div className="stat-value">{subs.length.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value" style={{ color: "var(--primary)" }}>{approved.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value" style={{ color: "var(--warn)" }}>{pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-value" style={{ color: "var(--error)" }}>{rejected}</div>
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
                <th>Reward</th>
                <th>Status</th>
                <th>TX Link</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => {
                const badge = STATUS_BADGE[s.status];
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: "var(--text)" }}>Job #{s.jobId}</td>
                    <td style={{ fontFamily: "'Space Grotesk', monospace" }}>#{s.taskId + 1}</td>
                    <td style={{ fontFamily: "'Space Grotesk', monospace", color: s.status === "approved" ? "var(--primary)" : "var(--text-3)", fontWeight: 600 }}>
                      {s.status === "approved" ? s.rewardPerTask : "—"}{" "}
                      {s.status === "approved" && <span style={{ fontSize: 11, color: "var(--text-3)" }}>0G</span>}
                    </td>
                    <td>
                      <span style={badge.style}>{badge.label}</span>
                    </td>
                    <td>
                      {s.txHash ? (
                        <a href={`${GALILEO.explorer}/tx/${s.txHash}`} target="_blank" rel="noreferrer" className="mono-tag" style={{ color: "var(--primary)" }}>
                          {s.txHash.slice(0, 8)}…{s.txHash.slice(-4)}
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-3)", fontSize: 12, fontStyle: "italic" }}>Awaiting Conf.</span>
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

