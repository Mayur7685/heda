import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";

export default function Landing() {
  const navigate = useNavigate();
  const { signer } = useWallet();
  const market = useAnnotationMarket(signer);
  const [stats, setStats] = useState({ totalJobs: 18, storageMB: "640 MB", activeAnnotators: 42, modelsTrained: 12 });
  const [activeTab, setActiveTab] = useState<"label" | "health" | "train">("label");

  useEffect(() => {
    if (!market) return;
    market.totalJobs().then((total) => {
      if (total) setStats((s) => ({ ...s, totalJobs: Number(total) }));
    }).catch(() => {});
  }, [!!market]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", overflowX: "hidden", color: "var(--text)" }}>
      {/* Background Radial Glow */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 1400, height: 600,
        background: "radial-gradient(ellipse 65% 45% at 50% -10%, rgba(0,228,121,0.18), transparent 75%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── 1. HERO SECTION ── */}
      <section style={{ position: "relative", zIndex: 1, paddingTop: 70, paddingBottom: 60, textAlign: "center", paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Status Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 20,
            background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.3)",
            fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 20,
            backdropFilter: "blur(8px)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 10px var(--primary)" }} />
            0G Galileo Testnet • Decentralized Computer Vision Protocol
          </div>

          {/* Hero Title */}
          <h1 style={{
            fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 800,
            lineHeight: 1.1, letterSpacing: "-0.03em", color: "#fff", marginBottom: 16,
          }}>
            Decentralized Data Engine for <br />
            <span style={{
              background: "linear-gradient(135deg, #00e479 0%, #7fff00 50%, #60a5fa 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Computer Vision & AI
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "clamp(15px, 1.8vw, 18px)", color: "var(--text-2)",
            maxWidth: 680, margin: "0 auto 28px", lineHeight: 1.5, fontWeight: 400,
          }}>
            Annotate image datasets, train PyTorch YOLO models, and earn 0G ETH payouts—100% onchain on 0G Storage.
          </p>

          {/* Action CTAs */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
            <button
              className="btn-primary"
              onClick={() => navigate("/jobs")}
              style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700, borderRadius: 8, gap: 8 }}
            >
              Start Labeling Free
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/datasets")}
              style={{ padding: "12px 24px", fontSize: 15, fontWeight: 600, borderRadius: 8, gap: 8 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>
              Explore Datasets
            </button>
          </div>

          {/* Hero Computer Vision Scanner Showcase */}
          <div style={{
            position: "relative", maxWidth: 940, margin: "0 auto", borderRadius: 14, overflow: "hidden",
            border: "1px solid var(--border)", background: "#050806",
            boxShadow: "0 25px 70px rgba(0,228,121,0.14), 0 0 1px 1px var(--border)",
          }}>
            <div style={{
              height: 38, background: "#0a0f0b", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5f56" }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ffbd2e" }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#27c93f" }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: "'Space Grotesk', monospace", color: "var(--text-3)" }}>
                heda-vision-scanner // 0G-Storage-Root: 0x7b617f...
              </span>
              <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
                LIVE AI DETECT
              </span>
            </div>

            <div style={{ position: "relative", width: "100%", height: 440, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80"
                alt="Computer Vision Realtime Detection"
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.88 }}
              />

              {/* Bounding Box Overlays */}
              <div style={{
                position: "absolute", left: "18%", top: "25%", width: "32%", height: "55%",
                border: "2px solid #00e479", background: "rgba(0,228,121,0.12)",
                boxShadow: "0 0 15px rgba(0,228,121,0.4)", borderRadius: 4,
              }}>
                <span style={{
                  position: "absolute", top: -20, left: 0, background: "#00e479", color: "#000",
                  fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 3, fontFamily: "'Space Grotesk', monospace",
                }}>
                  car · 96%
                </span>
              </div>

              <div style={{
                position: "absolute", left: "55%", top: "30%", width: "28%", height: "50%",
                border: "2px solid #60a5fa", background: "rgba(96,165,250,0.12)",
                boxShadow: "0 0 15px rgba(96,165,250,0.4)", borderRadius: 4,
              }}>
                <span style={{
                  position: "absolute", top: -20, left: 0, background: "#60a5fa", color: "#000",
                  fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 3, fontFamily: "'Space Grotesk', monospace",
                }}>
                  car · 92%
                </span>
              </div>

              <div style={{
                position: "absolute", left: "42%", top: "15%", width: "12%", height: "35%",
                border: "2px solid #ffd700", background: "rgba(255,215,0,0.12)",
                boxShadow: "0 0 15px rgba(255,215,0,0.4)", borderRadius: 4,
              }}>
                <span style={{
                  position: "absolute", top: -20, left: 0, background: "#ffd700", color: "#000",
                  fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 3, fontFamily: "'Space Grotesk', monospace",
                }}>
                  person · 98%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. VISUAL COMPUTER VISION USE-CASES GALLERY ── */}
      <section style={{ padding: "70px 24px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ color: "var(--primary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              VERSATILE COMPUTER VISION APPLICATIONS
            </span>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, marginTop: 6 }}>
              Trained for Any Physical Vision Task
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: 15, maxWidth: 600, margin: "10px auto 0" }}>
              From industrial safety compliance to autonomous mobility and urban infrastructure.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {/* Card 1: Industrial Safety */}
            <div style={{
              background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 12,
              overflow: "hidden", transition: "transform 0.2s ease, borderColor 0.2s ease",
            }}>
              <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
                <img
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80"
                  alt="Industrial Safety"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.85)",
                  backdropFilter: "blur(4px)", padding: "4px 12px", borderRadius: 20, fontSize: 11,
                  fontWeight: 700, color: "var(--primary)", border: "1px solid var(--primary)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>factory</span>
                  Industrial Safety
                </div>
                <div style={{
                  position: "absolute", bottom: "20%", left: "30%", width: "40%", height: "45%",
                  border: "2px solid #00e479", background: "rgba(0,228,121,0.15)", borderRadius: 3,
                }}>
                  <span style={{ position: "absolute", top: -18, left: 0, background: "#00e479", color: "#000", fontSize: 9, fontWeight: 800, padding: "1px 4px" }}>
                    hardhat · 98%
                  </span>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>PPE & Safety Inspection</h3>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                  Detect hardhats, safety vests, gloves, and protective gear in real-time.
                </p>
              </div>
            </div>

            {/* Card 2: Autonomous Driving */}
            <div style={{
              background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 12,
              overflow: "hidden", transition: "transform 0.2s ease, borderColor 0.2s ease",
            }}>
              <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
                <img
                  src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80"
                  alt="Autonomous Mobility"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.85)",
                  backdropFilter: "blur(4px)", padding: "4px 12px", borderRadius: 20, fontSize: 11,
                  fontWeight: 700, color: "#60a5fa", border: "1px solid #60a5fa",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>directions_car</span>
                  Autonomous Mobility
                </div>
                <div style={{
                  position: "absolute", top: "35%", left: "25%", width: "45%", height: "45%",
                  border: "2px solid #60a5fa", background: "rgba(96,165,250,0.15)", borderRadius: 3,
                }}>
                  <span style={{ position: "absolute", top: -18, left: 0, background: "#60a5fa", color: "#000", fontSize: 9, fontWeight: 800, padding: "1px 4px" }}>
                    pedestrian · 94%
                  </span>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Urban Traffic & Vehicles</h3>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                  Annotate multi-class traffic scenes, pedestrians, cars, and cyclists.
                </p>
              </div>
            </div>

            {/* Card 3: Smart Cities */}
            <div style={{
              background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 12,
              overflow: "hidden", transition: "transform 0.2s ease, borderColor 0.2s ease",
            }}>
              <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
                <img
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80"
                  alt="Smart Office & Assets"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.85)",
                  backdropFilter: "blur(4px)", padding: "4px 12px", borderRadius: 20, fontSize: 11,
                  fontWeight: 700, color: "#ffd700", border: "1px solid #ffd700",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>domain</span>
                  Asset Tracking
                </div>
                <div style={{
                  position: "absolute", top: "25%", left: "15%", width: "35%", height: "45%",
                  border: "2px solid #ffd700", background: "rgba(255,215,0,0.15)", borderRadius: 3,
                }}>
                  <span style={{ position: "absolute", top: -18, left: 0, background: "#ffd700", color: "#000", fontSize: 9, fontWeight: 800, padding: "1px 4px" }}>
                    laptop · 91%
                  </span>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Indoor Workspace & Assets</h3>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                  Inventory auditing, office asset localization, and object counting.
                </p>
              </div>
            </div>

            {/* Card 4: Healthcare & Vision */}
            <div style={{
              background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 12,
              overflow: "hidden", transition: "transform 0.2s ease, borderColor 0.2s ease",
            }}>
              <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
                <img
                  src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
                  alt="Medical Vision"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.85)",
                  backdropFilter: "blur(4px)", padding: "4px 12px", borderRadius: 20, fontSize: 11,
                  fontWeight: 700, color: "#a78bfa", border: "1px solid #a78bfa",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>medical_services</span>
                  Healthcare Vision
                </div>
                <div style={{
                  position: "absolute", top: "20%", left: "40%", width: "35%", height: "50%",
                  border: "2px solid #a78bfa", background: "rgba(167,139,250,0.15)", borderRadius: 3,
                }}>
                  <span style={{ position: "absolute", top: -18, left: 0, background: "#a78bfa", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 4px" }}>
                    anomaly · 97%
                  </span>
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Diagnostics & Pathology</h3>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                  High-precision bounding box annotations for clinical imagery.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. INTERACTIVE FEATURE TABS ── */}
      <section style={{ padding: "80px 24px", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800 }}>
              Complete End-to-End Workflow
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: 15, maxWidth: 550, margin: "10px auto 0" }}>
              Explore how Heda streamlines data creation, quality validation, and model deployment.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 36, alignItems: "center" }}>
            {/* Left Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  id: "label",
                  title: "Moondream VLM Auto-Label Assist",
                  desc: "1-click automated bounding box prediction using Vision Language Models inside the workspace.",
                  icon: "auto_awesome",
                },
                {
                  id: "health",
                  title: "Automated Dataset Health Check",
                  desc: "Quality score (0-100), class distribution histograms, and null box detection before training.",
                  icon: "health_and_safety",
                },
                {
                  id: "train",
                  title: "Local & Onchain YOLO Model Training",
                  desc: "Train PyTorch YOLOv8 models locally and publish fine-tuned weights to 0G Storage with onchain escrow.",
                  icon: "model_training",
                },
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    style={{
                      padding: 20, borderRadius: 10, cursor: "pointer", border: "1px solid",
                      borderColor: isActive ? "var(--primary)" : "var(--border)",
                      background: isActive ? "var(--primary-bg)" : "var(--surface)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span className="material-symbols-outlined" style={{ color: isActive ? "var(--primary)" : "var(--text-2)", fontSize: 22 }}>
                        {item.icon}
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: isActive ? "#fff" : "var(--text-2)" }}>
                        {item.title}
                      </h3>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Right Display */}
            <div style={{
              background: "#080c09", border: "1px solid var(--border)", borderRadius: 14,
              padding: 24, minHeight: 360, display: "flex", flexDirection: "column", justifyContent: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}>
              {activeTab === "label" && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: "rgba(0,228,121,0.1)", color: "var(--primary)", fontWeight: 700, fontSize: 12, marginBottom: 16 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                    Moondream VLM Auto-Label Active
                  </div>
                  <div style={{ background: "#000", border: "1px dashed var(--primary)", borderRadius: 8, padding: 24, display: "inline-block", maxWidth: 380 }}>
                    <div style={{ width: 140, height: 95, border: "2px solid #00e479", margin: "0 auto", position: "relative", background: "rgba(0,228,121,0.12)" }}>
                      <span style={{ position: "absolute", top: -18, left: 0, background: "#00e479", color: "#000", fontSize: 10, fontWeight: 800, padding: "2px 6px" }}>
                        hardhat · 98%
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 14, margin: 0 }}>
                      Detects target objects automatically with zero manual coordinate clicks required.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "health" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Dataset Health Report</span>
                    <span style={{ background: "rgba(0,228,121,0.15)", color: "var(--primary)", fontWeight: 800, padding: "4px 12px", borderRadius: 20, fontSize: 12 }}>
                      Quality Score: 94 / 100
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>Class Balance Ratio</span>
                        <span style={{ color: "var(--primary)" }}>92% Optimal</span>
                      </div>
                      <div style={{ width: "100%", height: 8, background: "var(--surface-high)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: "92%", height: "100%", background: "var(--primary)" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", background: "var(--surface-low)", padding: 12, borderRadius: 6, border: "1px solid var(--border)" }}>
                      ✓ 0 Null Annotation Tasks • ✓ 0 Duplicate Images • ✓ Balanced Box Sizes
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "train" && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginBottom: 10 }}>
                    PyTorch YOLOv8 Training Output
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, background: "#000", padding: 16, borderRadius: 8, border: "1px solid var(--border)", color: "#a78bfa", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>Epoch 1/10 — box_loss: 0.421, mAP50: 68.2%</div>
                    <div>Epoch 5/10 — box_loss: 0.184, mAP50: 89.5%</div>
                    <div style={{ color: "var(--primary)" }}>Epoch 10/10 — box_loss: 0.042, mAP50: 96.8% ✓</div>
                    <div style={{ color: "#fff", marginTop: 6 }}>Exported best.pt → Pinned to 0G Storage (Root: 0x8a92...)</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. NUMBERS & STATS ── */}
      <section style={{ padding: "50px 24px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>{stats.totalJobs}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Active Bounty Jobs</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>{stats.storageMB}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Pinned to 0G Storage</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#ffd700", fontFamily: "'Space Grotesk', monospace" }}>{stats.activeAnnotators}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Verified Annotators</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#a78bfa", fontFamily: "'Space Grotesk', monospace" }}>{stats.modelsTrained}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Trained YOLO Models</div>
          </div>
        </div>
      </section>

      {/* ── 5. CALL TO ACTION BANNER ── */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{
          maxWidth: 850, margin: "0 auto", padding: "50px 28px", borderRadius: 16,
          background: "linear-gradient(135deg, rgba(0,228,121,0.12) 0%, rgba(0,0,0,0.85) 100%)",
          border: "1px solid rgba(0,228,121,0.3)", boxShadow: "0 25px 70px rgba(0,228,121,0.12)",
        }}>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 800, marginBottom: 14 }}>
            Build Computer Vision Models on 0G
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: 16, maxWidth: 550, margin: "0 auto 28px" }}>
            Create custom image annotation jobs, fine-tune PyTorch YOLO models, and access open datasets.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              className="btn-primary"
              onClick={() => navigate("/create")}
              style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700, borderRadius: 8 }}
            >
              Create Annotation Job
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/models")}
              style={{ padding: "12px 24px", fontSize: 15, fontWeight: 600, borderRadius: 8 }}
            >
              Test Model Universe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
