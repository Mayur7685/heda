import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";

export default function Landing() {
  const navigate = useNavigate();
  const { signer } = useWallet();
  const market = useAnnotationMarket(signer);
  const [stats, setStats] = useState({ totalJobs: 12, storageMB: "450 MB", activeAnnotators: 28, modelsTrained: 6 });


  useEffect(() => {
    if (!market) return;
    market.totalJobs().then((total) => {
      if (total) setStats((s) => ({ ...s, totalJobs: Number(total) }));
    }).catch(() => {});
  }, [!!market]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", overflowX: "hidden" }}>
      {/* ── Background Glow Overlay ── */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 1200, height: 600,
        background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,228,121,0.15), transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── Hero Section ── */}
      <section style={{ position: "relative", zIndex: 1, paddingTop: 100, paddingBottom: 60, textAlign: "center", paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Status Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 20,
            background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.3)",
            fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 28,
            backdropFilter: "blur(8px)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 10px var(--primary)", animation: "pulse-fade 2s infinite" }} />
            0G Network Testnet Live • AI + IoT + Decentralized Storage Protocol
          </div>

          {/* Main Title */}
          <h1 style={{
            fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 800,
            lineHeight: 1.1, letterSpacing: "-0.03em", color: "#fff", marginBottom: 24,
          }}>
            The Autonomous Data Engine for <br />
            <span style={{
              background: "linear-gradient(135deg, #00e479 0%, #60ff99 50%, #00bfff 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Physical AI & Edge Intelligence
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "var(--text-2)", lineHeight: 1.6, maxWidth: 740, margin: "0 auto 36px" }}>
            Connect edge devices (ESP32, Raspberry Pi), auto-label datasets with Moondream VLMs,
            lock trustless bounties on 0G Storage, and monetise fine-tuned computer vision models onchain.
          </p>

          {/* Action CTAs */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 }}>
            <button className="btn-primary" onClick={() => navigate("/jobs")}
              style={{ padding: "14px 28px", fontSize: 15, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,228,121,0.25)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>rocket_launch</span>
              Explore Jobs Marketplace
            </button>
            <button className="btn-secondary" onClick={() => navigate("/create")}
              style={{ padding: "14px 28px", fontSize: 15, borderRadius: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
              Create Bounty Job
            </button>
            <button onClick={() => navigate("/datasets")}
              style={{ padding: "14px 24px", fontSize: 15, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>database</span>
              View Datasets
            </button>
          </div>

          {/* Key Metrics Banner */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>{stats.totalJobs}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, fontWeight: 500 }}>Active Bounty Jobs</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>0G DA</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, fontWeight: 500 }}>Decentralized Storage</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa", fontFamily: "'Space Grotesk', monospace" }}>Moondream</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, fontWeight: 500 }}>VLM Auto-Label Assist</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#ffd700", fontFamily: "'Space Grotesk', monospace" }}>100%</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, fontWeight: 500 }}>Trustless Smart Escrow</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Interactive AI Showcase Section ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 24px" }}>
        <div style={{
          background: "linear-gradient(180deg, var(--surface) 0%, var(--surface-low) 100%)",
          border: "1px solid var(--border)", borderRadius: 16, padding: 36,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignItems: "center",
        }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#a78bfa", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
              Layer 2 • AI Label Assist
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
              Zero-Shot VLM Auto-Annotation
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Heda integrates Moondream Vision Language Models directly inside the browser workspace.
              Annotators get instant object detection suggestions (hardhats, safety equipment, industrial tools)
              with 1-click confirmation — speeding up throughput by 10x.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "bolt", title: "Instant Suggestion Engine", desc: "Performs parallel multi-class detection across images" },
                { icon: "security", title: "Merkle Data Verification", desc: "Every bounding box coordinate is hashed & pinned to 0G Storage" },
                { icon: "memory", title: "Edge & IoT Ready", desc: "Exports directly to YOLOv8 & PyTorch format for ESP32/Jetson devices" },
              ].map((feat, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{feat.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{feat.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{feat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock Interactive Visual Box */}
          <div style={{
            background: "#0c160e", border: "1px solid var(--border)", borderRadius: 12, padding: 16,
            position: "relative", overflow: "hidden", boxShadow: "0 16px 32px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#a78bfa" }}>photo_camera</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Worker_Safety_Inspection.jpg</span>
              </div>
              <span style={{ fontSize: 10, background: "rgba(167,139,250,0.2)", color: "#a78bfa", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                Moondream Active
              </span>
            </div>

            {/* Canvas mockup image */}
            <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#141e16" }}>
              <img
                src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=700&auto=format&fit=crop&q=80"
                alt="Construction Safety"
                style={{ width: "100%", height: 260, objectFit: "cover", display: "block", opacity: 0.85 }}
              />
              {/* Overlay Box 1 */}
              <div style={{
                position: "absolute", top: "18%", left: "38%", width: "24%", height: "28%",
                border: "2px solid #00e479", background: "rgba(0,228,121,0.15)", borderRadius: 4,
                boxShadow: "0 0 12px rgba(0,228,121,0.4)",
              }}>
                <span style={{ position: "absolute", top: -20, left: -2, background: "#00e479", color: "#000", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 2 }}>
                  hardhat · 96%
                </span>
              </div>
              {/* Overlay Box 2 */}
              <div style={{
                position: "absolute", top: "42%", left: "32%", width: "36%", height: "45%",
                border: "2px solid #a78bfa", background: "rgba(167,139,250,0.15)", borderRadius: 4,
              }}>
                <span style={{ position: "absolute", top: -20, left: -2, background: "#a78bfa", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 2 }}>
                  safety_vest · 91%
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 11, color: "var(--text-3)" }}>
              <span>2 Detections auto-suggested</span>
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>1-Click Accept All ✓</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5-Layer Platform Architecture Visualizer ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span className="label-caps" style={{ color: "var(--primary)" }}>End-to-End Technology Stack</span>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#fff", marginTop: 6 }}>
            5 Layers of Decentralized Data Intelligence
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            {
              layer: "LAYER 1",
              title: "Physical IoT Devices",
              subtitle: "ESP32, Pi 4, Jetson",
              desc: "Edge sensors & cameras capture real-world data and stream directly to 0G Storage DAG.",
              icon: "memory",
              color: "#60a5fa",
            },
            {
              layer: "LAYER 2",
              title: "AI Auto-Labeling",
              subtitle: "Moondream & Active Learning",
              desc: "VLM models auto-annotate raw images and text, highlighting low-confidence samples.",
              icon: "smart_toy",
              color: "#a78bfa",
            },
            {
              layer: "LAYER 3",
              title: "0G Decentralized Storage",
              subtitle: "Merkle DAG & Escrow",
              desc: "Immutable root hashes store annotations on 0G Storage with smart contract escrow payout.",
              icon: "token",
              color: "#00e479",
            },
            {
              layer: "LAYER 4",
              title: "Model Fine-Tuning",
              subtitle: "YOLOv8 & 0G Compute",
              desc: "Train vision models on verified datasets; track accuracy, mAP, and health metrics.",
              icon: "model_training",
              color: "#ffd700",
            },
            {
              layer: "LAYER 5",
              title: "Monetization Market",
              subtitle: "Dataset & Model Registry",
              desc: "Publish verified datasets & model weights to on-chain registries for revenue sharing.",
              icon: "storefront",
              color: "#ff69b4",
            },
          ].map((item, i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24,
              display: "flex", flexDirection: "column", transition: "transform 0.2s, border-color 0.2s",
              cursor: "default",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = item.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: item.color, background: `${item.color}15`, padding: "3px 8px", borderRadius: 4 }}>
                  {item.layer}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: item.color }}>{item.icon}</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{item.title}</h3>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12, fontWeight: 500 }}>{item.subtitle}</div>
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, marginTop: "auto" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Physical Device Stream Feature Banner ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 24px" }}>
        <div style={{
          background: "radial-gradient(circle at top right, rgba(96,165,250,0.12), transparent 50%), var(--surface)",
          border: "1px solid var(--border)", borderRadius: 16, padding: 36,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24,
        }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#60a5fa", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hardware</span>
              Physical IoT Device Network
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
              Stream Camera Feeds directly from ESP32 & Raspberry Pi
            </h3>
            <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>
              Connect real-world edge hardware to stream image batches to 0G Storage automatically.
              Create bounties for human annotators or trigger autonomous VLM labeling pipelines.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-primary" onClick={() => navigate("/create")} style={{ padding: "12px 20px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sensors</span>
              Deploy IoT Feed Job
            </button>
          </div>
        </div>
      </section>

      {/* ── Final Call to Action Footer Banner ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 24px", textAlign: "center" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(0,228,121,0.12) 0%, rgba(96,255,153,0.05) 100%)",
          border: "1px solid rgba(0,228,121,0.3)", borderRadius: 16, padding: 48,
        }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 16 }}>
            Ready to Build Decentralized AI Datasets?
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: 15, maxWidth: 600, margin: "0 auto 28px" }}>
            Earn 0G tokens by contributing high-quality annotations, or post bounties to label your machine learning datasets securely onchain.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => navigate("/jobs")} style={{ padding: "14px 28px", fontSize: 15 }}>
              Browse Available Jobs
            </button>
            <button className="btn-secondary" onClick={() => navigate("/submissions")} style={{ padding: "14px 28px", fontSize: 15 }}>
              Check My Work & Earnings
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
