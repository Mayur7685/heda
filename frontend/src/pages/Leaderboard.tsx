import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { GALILEO } from "../config";

interface AnnotatorStats {
  address: string;
  tasksApproved: number;
  tasksSubmitted: number;
  totalEarned0G: string;
  totalEarnedRaw: number;
  avgIou: number;
  approvalRate: number;
  rank: number;
  level: string;
  badgeColor: string;
}

export default function Leaderboard() {
  const { address: userAddress } = useWallet();
  const [annotators, setAnnotators] = useState<AnnotatorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"earned" | "approved" | "quality">("earned");

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      // Fetch live V2 indexer leaderboard API
      const res = await fetch("http://localhost:3001/annotations/leaderboard");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.leaderboard) && data.leaderboard.length > 0) {
          const list: AnnotatorStats[] = data.leaderboard.map((item: any, idx: number) => {
            const avgIou = item.avg_iou_score || 0;
            const approved = (item.total_evaluated || 0) - (item.total_rejected || 0);
            const rate = item.total_evaluated > 0 ? Math.round((approved / item.total_evaluated) * 100) : 100;

            const weiVal = BigInt(item.total_earned_wei || "0");
            const ethStr = ethers.formatEther(weiVal);
            const ethNum = parseFloat(ethStr);
            const formattedEarned = ethNum > 0 ? (ethNum < 0.0001 ? "<0.0001" : ethNum.toFixed(4)) : "0.0000";

            let level = "Verified Annotator";
            let badgeColor = "#60a5fa";
            if (avgIou >= 0.85 || approved >= 20) {
              level = "Grandmaster Annotator";
              badgeColor = "#ffd700";
            } else if (avgIou >= 0.70 || approved >= 10) {
              level = "Master Annotator";
              badgeColor = "#00e479";
            } else if (avgIou >= 0.50 || approved >= 3) {
              level = "Expert Annotator";
              badgeColor = "#7fff00";
            }

            return {
              address: item.address,
              tasksApproved: approved,
              tasksSubmitted: item.total_submissions,
              totalEarned0G: formattedEarned,
              totalEarnedRaw: ethNum,
              avgIou,
              approvalRate: rate,
              rank: idx + 1,
              level,
              badgeColor,
            };
          });

          setAnnotators(list);
        } else {
          setAnnotators([]);
        }
      }
    } catch (e) {
      console.warn("V2 leaderboard API note:", e);
      setAnnotators([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = annotators
    .filter((a) => a.address.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "approved") return b.tasksApproved - a.tasksApproved;
      if (sortBy === "quality") return b.avgIou - a.avgIou;
      return b.totalEarnedRaw - a.totalEarnedRaw;
    });

  const top3 = annotators.slice(0, 3);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header Banner */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", padding: "40px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--primary)" }}>
              trophy
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              Annotator Leaderboard
            </h1>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 15, margin: 0, maxWidth: 650 }}>
            Rankings and earnings of top data annotators on 0G Galileo Testnet. Earn 0G ETH per approved task.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>
        {/* Top 3 Podium */}
        {!loading && top3.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 40 }}>
            {top3.map((a, idx) => {
              const ranks = [
                { title: "🥇 1st Place", border: "2px solid #ffd700", bg: "rgba(255,215,0,0.06)", color: "#ffd700" },
                { title: "🥈 2nd Place", border: "2px solid #c0c0c0", bg: "rgba(192,192,192,0.06)", color: "#c0c0c0" },
                { title: "🥉 3rd Place", border: "2px solid #cd7f32", bg: "rgba(205,127,50,0.06)", color: "#cd7f32" },
              ];
              const r = ranks[idx] || ranks[2];
              const isCurrentUser = userAddress && a.address.toLowerCase() === userAddress.toLowerCase();

              return (
                <div key={a.address} style={{
                  background: "var(--surface)", border: r.border, borderRadius: 12, padding: 24,
                  display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
                  boxShadow: `0 10px 30px ${r.bg}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {r.title}
                    </span>
                    {isCurrentUser && (
                      <span className="badge badge-approved" style={{ fontSize: 10 }}>YOU</span>
                    )}
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', monospace", color: "var(--text)", marginBottom: 4 }}>
                    {a.address.slice(0, 8)}…{a.address.slice(-6)}
                  </div>
                  <div style={{ fontSize: 11, color: a.badgeColor, fontWeight: 700, marginBottom: 16 }}>
                    {a.level}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)", marginTop: "auto" }}>
                    <div>
                      <div style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase" }}>Total Earned</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>
                        {a.totalEarned0G} <span style={{ fontSize: 10 }}>0G</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase" }}>Avg Quality</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>
                        {(a.avgIou * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase" }}>Approved</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", fontFamily: "'Space Grotesk', monospace" }}>
                        {a.tasksApproved} <span style={{ fontSize: 10 }}>tasks</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`filter-pill ${sortBy === "earned" ? "active" : ""}`}
              onClick={() => setSortBy("earned")}
            >
              Top Earners (0G ETH)
            </button>
            <button
              className={`filter-pill ${sortBy === "quality" ? "active" : ""}`}
              onClick={() => setSortBy("quality")}
            >
              Highest Quality (Avg IoU)
            </button>
            <button
              className={`filter-pill ${sortBy === "approved" ? "active" : ""}`}
              onClick={() => setSortBy("approved")}
            >
              Most Approved Tasks
            </button>
          </div>

          <div style={{ position: "relative", width: 280 }}>
            <input
              type="text"
              placeholder="Search annotator address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: "100%", fontSize: 13 }}
            />
            <span className="material-symbols-outlined" style={{ position: "absolute", left: 10, top: 10, fontSize: 18, color: "var(--text-3)" }}>
              search
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
              <span className="material-symbols-outlined spinning" style={{ fontSize: 32, marginBottom: 8, display: "block" }}>sync</span>
              Calculating annotator rankings from 0G Galileo Testnet...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 8, display: "block" }}>group_off</span>
              No annotator activity recorded yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Annotator</th>
                  <th>Tier Level</th>
                  <th style={{ textAlign: "right" }}>Avg Quality</th>
                  <th style={{ textAlign: "right" }}>Approved Tasks</th>
                  <th style={{ textAlign: "right" }}>Approval Rate</th>
                  <th style={{ textAlign: "right" }}>Total Earned</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const isCurrentUser = userAddress && a.address.toLowerCase() === userAddress.toLowerCase();
                  return (
                    <tr key={a.address} style={{ background: isCurrentUser ? "rgba(0,228,121,0.05)" : "transparent" }}>
                      <td>
                        <span style={{
                          fontFamily: "'Space Grotesk', monospace", fontWeight: 800, fontSize: 14,
                          color: a.rank === 1 ? "#ffd700" : a.rank === 2 ? "#c0c0c0" : a.rank === 3 ? "#cd7f32" : "var(--text-2)"
                        }}>
                          #{a.rank}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <a href={`${GALILEO.explorer}/address/${a.address}`} target="_blank" rel="noreferrer" style={{ color: "var(--text)", textDecoration: "none", fontFamily: "'Space Grotesk', monospace", fontWeight: 600 }}>
                            {a.address.slice(0, 8)}…{a.address.slice(-6)}
                          </a>
                          {isCurrentUser && (
                            <span className="badge badge-approved" style={{ fontSize: 10 }}>YOU</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, color: a.badgeColor, background: `${a.badgeColor}15`, padding: "2px 8px", borderRadius: 4, border: `1px solid ${a.badgeColor}33` }}>
                          {a.level}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: "#60a5fa" }}>
                        {(a.avgIou * 100).toFixed(1)}% IoU
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "'Space Grotesk', monospace", fontWeight: 600 }}>
                        {a.tasksApproved} / {a.tasksSubmitted}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "'Space Grotesk', monospace", color: a.approvalRate >= 90 ? "var(--primary)" : "var(--warn)" }}>
                        {a.approvalRate}%
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "'Space Grotesk', monospace", fontWeight: 800, color: "var(--primary)" }}>
                        {a.totalEarned0G} 0G
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
