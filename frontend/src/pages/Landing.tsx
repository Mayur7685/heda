import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarketV2 } from "../hooks/useAnnotationMarketV2";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { useModelRegistry } from "../hooks/useModelRegistry";

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || "http://localhost:3001";

export default function Landing() {
  const navigate = useNavigate();
  const { signer } = useWallet();
  const marketV2 = useAnnotationMarketV2(signer);
  const datasetRegistry = useDatasetRegistry(signer);
  const modelRegistry = useModelRegistry(signer);

  const [stats, setStats] = useState({
    totalJobs: 0,
    totalDatasets: 0,
    activeAnnotators: 0,
    modelsTrained: 0,
  });

  const [vlmTab, setVlmTab] = useState<string>("Object Detection");
  const [vlmFilter, setVlmFilter] = useState<"All" | "Open" | "Closed">("All");
  const [activeWorkflowRule, setActiveWorkflowRule] = useState<number>(0);
  const [isPlayingHeroVideo, setIsPlayingHeroVideo] = useState<boolean>(false);

  useEffect(() => {
    // 1. Fetch total bounty jobs onchain
    if (marketV2) {
      marketV2.totalJobs().then((total) => {
        if (total !== undefined) setStats((s) => ({ ...s, totalJobs: Number(total) }));
      }).catch(() => { });
    }

    // 2. Fetch total datasets onchain
    if (datasetRegistry) {
      datasetRegistry.totalDatasets().then((total) => {
        if (total !== undefined) setStats((s) => ({ ...s, totalDatasets: Number(total) }));
      }).catch(() => { });
    }

    // 3. Fetch total models onchain
    if (modelRegistry) {
      modelRegistry.totalModels().then((total) => {
        if (total !== undefined) setStats((s) => ({ ...s, modelsTrained: Number(total) }));
      }).catch(() => { });
    }

    // 4. Fetch unique verified annotators count from relayer
    fetch(`${RELAYER_URL}/annotations/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.leaderboard && Array.isArray(data.leaderboard)) {
          setStats((s) => ({ ...s, activeAnnotators: data.leaderboard.length }));
        }
      })
      .catch(() => { });
  }, [marketV2, datasetRegistry, modelRegistry]);

  return (
    <div style={{ background: "var(--bg, #080c09)", minHeight: "100vh", overflowX: "hidden", color: "var(--text, #dee4dc)" }}>
      {/* ── Background Subtle Glow ── */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 1400, height: 620,
        background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(0,228,121,0.18), transparent 75%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── 1. HERO SECTION (WITH PLATFORM VIDEO MONTAGE SHOWCASE) ── */}
      <section style={{ position: "relative", zIndex: 1, paddingTop: 64, paddingBottom: 64, textAlign: "center", paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          {/* Status Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 20,
            background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.3)",
            fontSize: 12, fontWeight: 700, color: "var(--primary, #00e479)", marginBottom: 24,
            backdropFilter: "blur(8px)", boxShadow: "0 0 16px rgba(0, 228, 121, 0.15)",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary, #00e479)", boxShadow: "0 0 10px #00e479" }} />
            0G Galileo Testnet • Decentralized Computer Vision Protocol
          </div>

          {/* Hero Title */}
          <h1 style={{
            fontSize: "clamp(38px, 5.8vw, 68px)", fontWeight: 800,
            lineHeight: 1.1, letterSpacing: "-0.03em", color: "#ffffff", marginBottom: 22,
          }}>
            Decentralized Data Engine for <br />
            Computer Vision & AI
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "clamp(15px, 2vw, 18.5px)", color: "var(--text-2, #b9cbb9)",
            maxWidth: 780, margin: "0 auto 34px", lineHeight: 1.65, fontWeight: 400,
          }}>
            Connect physical IoT cameras, annotate datasets with AI assist, reach decentralized multi-annotator consensus, and fine-tune PyTorch YOLO models—100% onchain on 0G Storage.
          </p>

          {/* Action CTAs */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 50 }}>
            <button
              className="btn-primary"
              onClick={() => navigate("/jobs")}
              style={{ padding: "13px 30px", fontSize: 15, fontWeight: 700, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 0 24px rgba(0,228,121,0.3)" }}
            >
              Start Labeling Free
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/pipeline")}
              style={{ padding: "13px 26px", fontSize: 15, fontWeight: 700, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary, #00e479)" }}>bolt</span>
              RapidCV Studio
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/datasets")}
              style={{ padding: "13px 24px", fontSize: 15, fontWeight: 600, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>
              Explore Datasets
            </button>
          </div>

          {/* Hero Video Montage Showcase Container */}
          <div style={{
            position: "relative", maxWidth: 980, margin: "0 auto", borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(0, 228, 121, 0.35)", background: "#050806",
            boxShadow: "0 25px 80px rgba(0,228,121,0.22), 0 0 1px 1px var(--border)",
          }}>
            {/* Top Video Header Bar */}
            <div style={{
              height: 42, background: "#0c130e", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                <span style={{ marginLeft: 12, fontSize: 12, fontFamily: "'Space Grotesk', monospace", color: "var(--text-3, #849584)" }}>
                  0G Heda // Platform Overview Video Montage
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, background: "rgba(0, 228, 121, 0.12)", color: "var(--primary, #00e479)", padding: "3px 10px", borderRadius: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>movie</span>
                  4K 60FPS
                </span>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'Space Grotesk', monospace" }}>
                  02:45
                </span>
              </div>
            </div>

            {/* Video Player Canvas / Montage Placeholder */}
            <div
              onClick={() => setIsPlayingHeroVideo(!isPlayingHeroVideo)}
              style={{
                position: "relative", height: 460, background: "#000",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                backgroundImage: "url('https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80')",
                backgroundSize: "cover", backgroundPosition: "center",
              }}
            >
              {/* Dark Gradient Overlay */}
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(8,12,9,0.85) 100%)" }} />

              {/* Glassmorphic Play Button & Title */}
              <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 76, height: 76, borderRadius: "50%",
                  background: "rgba(0, 228, 121, 0.2)", border: "2px solid var(--primary, #00e479)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                  boxShadow: "0 0 32px rgba(0,228,121,0.5)", backdropFilter: "blur(10px)",
                  transition: "transform 0.2s ease",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, marginLeft: 4, color: "var(--primary, #00e479)" }}>
                    play_arrow
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                    Watch Platform Video Montage
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2, #b9cbb9)", marginTop: 4 }}>
                    End-to-end dataset creation, VLM consensus & PyTorch YOLO model training
                  </div>
                </div>
              </div>

              {/* Video Bottom Progress Bar Overlay */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 20px", background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%)", display: "flex", alignItems: "center", gap: 14, zIndex: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--primary)" }}>play_circle</span>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: "35%", height: "100%", background: "var(--primary, #00e479)", borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: "'Space Grotesk', monospace", color: "var(--text-3)" }}>00:58 / 02:45</span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-3)" }}>fullscreen</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. REVOLVING SCROLLING IMAGE GRID (2 ROWS) ── */}
      <section style={{ padding: "40px 0 60px", overflow: "hidden", position: "relative", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "#050806" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 120, background: "linear-gradient(90deg, #050806 0%, transparent 100%)", zIndex: 10, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 120, background: "linear-gradient(270deg, #050806 0%, transparent 100%)", zIndex: 10, pointerEvents: "none" }} />

        <div style={{ textAlign: "center", marginBottom: 28, padding: "0 24px" }}>
          <span style={{ color: "var(--primary, #00e479)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            COMPUTER VISION DATASET UNIVERSE
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0", color: "#fff" }}>
            Endless Computer Vision Tasks Will Trained on 0G
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Row 1: Left Scroll */}
          <div className="marquee-row-1" style={{ display: "flex", gap: 16, width: "max-content" }}>
            {[
              { title: "Industrial PPE Safety", tag: "hardhat · vest · gloves", img: "/ppe_safety.png" },
              { title: "Autonomous Urban Mobility", tag: "car · pedestrian · bicycle", img: "/urban_mobility.png" },
              { title: "Smart Retail & Stock", tag: "shelf · product · barcode", img: "/smart_retail.png" },
              { title: "Medical Slide Diagnostics", tag: "cell · anomaly · tissue", img: "/medical_diagnostics.png" },
              { title: "Smart Agriculture", tag: "crop · weed · ripeness", img: "/smart_agriculture.png" },
              { title: "Logistics Warehouse Fleet", tag: "forklift · pallet · box", img: "/logistics_warehouse.png" },
              // Loop duplicate
              { title: "Industrial PPE Safety", tag: "hardhat · vest · gloves", img: "/ppe_safety.png" },
              { title: "Autonomous Urban Mobility", tag: "car · pedestrian · bicycle", img: "/urban_mobility.png" },
              { title: "Smart Retail & Stock", tag: "shelf · product · barcode", img: "/smart_retail.png" },
              { title: "Medical Slide Diagnostics", tag: "cell · anomaly · tissue", img: "/medical_diagnostics.png" },
              { title: "Smart Agriculture", tag: "crop · weed · ripeness", img: "/smart_agriculture.png" },
              { title: "Logistics Warehouse Fleet", tag: "forklift · pallet · box", img: "/logistics_warehouse.png" },
            ].map((item, i) => (
              <div
                key={i}
                onClick={() => navigate("/datasets")}
                style={{
                  width: 260, height: 160, borderRadius: 12, overflow: "hidden", position: "relative",
                  border: "1px solid var(--border)", cursor: "pointer", flexShrink: 0, background: "#0c130e",
                  transition: "transform 0.2s ease, borderColor 0.2s ease",
                }}
              >
                <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)", padding: 14, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{item.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--primary, #00e479)", fontFamily: "'Space Grotesk', monospace" }}>{item.tag}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2: Right Scroll */}
          <div className="marquee-row-2" style={{ display: "flex", gap: 16, width: "max-content" }}>
            {[
              { title: "Robotics Precision Grasping", tag: "gripper · arm · object", img: "/robotics_grasping.png" },
              { title: "Aerial Drone Infrastructure", tag: "solar_panel · crack · roof", img: "/drone_inspection.png" },
              { title: "Smart City Traffic Cameras", tag: "speeding · lane · license_plate", img: "/traffic_camera.png" },
              { title: "Manufacturing Surface Flaws", tag: "scratch · dent · welding", img: "/manufacturing_flaws.png" },
              { title: "Sports Analytics & Pose", tag: "player · ball · trajectory", img: "/sports_analytics.png" },
              { title: "Office Asset Localization", tag: "laptop · monitor · chair", img: "/office_assets.png" },
              // Loop duplicate
              { title: "Robotics Precision Grasping", tag: "gripper · arm · object", img: "/robotics_grasping.png" },
              { title: "Aerial Drone Infrastructure", tag: "solar_panel · crack · roof", img: "/drone_inspection.png" },
              { title: "Smart City Traffic Cameras", tag: "speeding · lane · license_plate", img: "/traffic_camera.png" },
              { title: "Manufacturing Surface Flaws", tag: "scratch · dent · welding", img: "/manufacturing_flaws.png" },
              { title: "Sports Analytics & Pose", tag: "player · ball · trajectory", img: "/sports_analytics.png" },
              { title: "Office Asset Localization", tag: "laptop · monitor · chair", img: "/office_assets.png" },
            ].map((item, i) => (
              <div
                key={i}
                onClick={() => navigate("/datasets")}
                style={{
                  width: 260, height: 160, borderRadius: 12, overflow: "hidden", position: "relative",
                  border: "1px solid var(--border)", cursor: "pointer", flexShrink: 0, background: "#0c130e",
                  transition: "transform 0.2s ease, borderColor 0.2s ease",
                }}
              >
                <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)", padding: 14, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{item.title}</div>
                  <div style={{ fontSize: 10.5, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>{item.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. LIVE FEATURE 1: ANNOTATION WORKSPACE (ANNOTATION MARKET) ── */}
      <section style={{ padding: "80px 24px", background: "var(--surface, #121a14)", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Top Badge & Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              DECENTRALIZED ANNOTATION WORKSPACE
            </span>
            <span style={{ fontSize: 11, background: "rgba(0, 228, 121, 0.12)", color: "var(--primary)", border: "1px solid var(--primary)", padding: "4px 10px", borderRadius: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
              LIVE ON GALILEO
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: "#fff" }}>
            Precision Labeling with Bounding Box & Polygon Tools
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 15, maxWidth: 680, margin: "0 0 36px" }}>
            Annotate high-resolution frames with custom polygon tools, multi-class bounding boxes, and instant cryptographic submission to 0G Storage.
          </p>

          {/* Real Platform Workspace UI Replica */}
          <div style={{
            position: "relative", borderRadius: 12, overflow: "hidden",
            border: "1px solid var(--border)", background: "#080c09",
          }}>
            {/* Top Workspace Task Bar */}
            <div style={{
              height: 48, background: "var(--surface-high, #111a13)", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-3)" }}>arrow_back</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  Job #1 — Safety Inspection
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontFamily: "'Space Grotesk', monospace" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>chevron_left</span>
                  <span>Task 1 of 10</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>chevron_right</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "'Space Grotesk', monospace" }}>
                  Bounty: <b style={{ color: "var(--primary)" }}>0.005 0G</b>
                </span>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => navigate("/jobs")}
                  style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, fontWeight: 700 }}
                >
                  Submit Task
                </button>
              </div>
            </div>

            {/* Main Layout: Canvas Area + Right Sidebar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", height: 460, background: "#080c09" }}>
              {/* Canvas Column */}
              <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", position: "relative", background: "#060907" }}>
                {/* Horizontal Toolbar directly above image */}
                <div style={{
                  height: 38, background: "rgba(12, 22, 14, 0.95)", borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "center", padding: "0 12px", gap: 6,
                }}>
                  <button style={{ padding: "4px 6px", background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center" }} title="Select (V)">
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>arrow_selector_tool</span>
                  </button>
                  <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                  <button style={{ padding: "4px 8px", background: "rgba(0, 228, 121, 0.15)", border: "1px solid var(--primary)", borderRadius: 4, color: "var(--primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_box_outline_blank</span>
                    Box
                  </button>
                  <button style={{ padding: "4px 8px", background: "transparent", border: "1px solid transparent", borderRadius: 4, color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>polyline</span>
                    Polygon
                  </button>
                  <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 4, fontSize: 11 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--text-3)" }}>label</span>
                    <span style={{ color: "#fff", fontWeight: 600 }}>hardhat</span>
                  </div>
                  <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
                  <button style={{ padding: 4, background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>zoom_out</span>
                  </button>
                  <span style={{ fontSize: 10.5, fontFamily: "'Space Grotesk', monospace", color: "var(--text-2)" }}>100%</span>
                  <button style={{ padding: 4, background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>zoom_in</span>
                  </button>
                </div>

                {/* Canvas with hardhat.jpg and exact Bounding Boxes */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#020403", padding: 12 }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: 612, aspectRatio: "612 / 408", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, overflow: "hidden" }}>
                    <img
                      src="/hardhat.jpg"
                      alt="Workplace PPE Hardhat Inspection"
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                    />

                    {/* Hardhat BBox (166, 12, 307, 111 on 612x408) */}
                    <div style={{
                      position: "absolute",
                      left: "27.12%",
                      top: "2.94%",
                      width: "23.04%",
                      height: "24.26%",
                      border: "2px solid #00ff88",
                      background: "rgba(0, 255, 136, 0.12)",
                      borderRadius: 1,
                    }}>
                      <span style={{
                        position: "absolute", top: 4, left: 4, color: "#00ff88",
                        fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk', monospace",
                      }}>
                        hardhat
                      </span>
                      {/* Corner resize anchors */}
                      <div style={{ position: "absolute", top: -4, left: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00ff88", borderRadius: 1 }} />
                      <div style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00ff88", borderRadius: 1 }} />
                      <div style={{ position: "absolute", bottom: -4, left: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00ff88", borderRadius: 1 }} />
                      <div style={{ position: "absolute", bottom: -4, right: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00ff88", borderRadius: 1 }} />
                    </div>

                    {/* Safety Vest BBox (121, 157, 369, 407 on 612x408) */}
                    <div style={{
                      position: "absolute",
                      left: "19.77%",
                      top: "38.48%",
                      width: "40.52%",
                      height: "61.27%",
                      border: "2px solid #00bfff",
                      background: "rgba(0, 191, 255, 0.12)",
                      borderRadius: 1,
                    }}>
                      <span style={{
                        position: "absolute", top: 4, left: 4, color: "#00bfff",
                        fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk', monospace",
                      }}>
                        safety_vest
                      </span>
                      {/* Corner resize anchors */}
                      <div style={{ position: "absolute", top: -4, left: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00bfff", borderRadius: 1 }} />
                      <div style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00bfff", borderRadius: 1 }} />
                      <div style={{ position: "absolute", bottom: -4, left: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00bfff", borderRadius: 1 }} />
                      <div style={{ position: "absolute", bottom: -4, right: -4, width: 8, height: 8, background: "#fff", border: "1px solid #00bfff", borderRadius: 1 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Annotations List & Shortcuts */}
              <aside style={{ background: "var(--surface, #121a14)", padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid var(--border)", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.06em" }}>
                      Annotations (2)
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", cursor: "pointer" }}>Clear all</span>
                  </div>

                  {/* Annotation List Items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-high, #18231c)", borderRadius: 4, borderLeft: "3px solid #00ff88" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#fff" }}>hardhat</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>delete</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-high, #18231c)", borderRadius: 4, borderLeft: "3px solid #00bfff" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00bfff" }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#fff" }}>safety_vest</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>delete</span>
                    </div>
                  </div>

                  {/* Shortcuts Section */}
                  <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.06em" }}>
                      Keyboard Shortcuts
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, fontSize: 11, color: "var(--text-2)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Box Tool</span><code style={{ color: "var(--primary)" }}>B</code></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Polygon Tool</span><code style={{ color: "var(--primary)" }}>P</code></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Select Tool</span><code style={{ color: "var(--primary)" }}>V</code></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Delete Box</span><code style={{ color: "var(--primary)" }}>Del</code></div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Area */}
                <div>
                  <button
                    className="btn-primary"
                    onClick={() => navigate("/jobs")}
                    style={{ width: "100%", justifyContent: "center", padding: "9px 0", fontSize: 12, fontWeight: 700, borderRadius: 6 }}
                  >
                    Open Workspace Jobs →
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. LIVE FEATURE 2: QUALITY CONSENSUS & REWARDS ── */}
      <section style={{ padding: "80px 24px", background: "#080c09", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Top Right LIVE Badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              DECENTRALIZED QUALITY VERIFICATION
            </span>
            <span style={{ fontSize: 11, background: "rgba(0, 228, 121, 0.12)", color: "var(--primary)", border: "1px solid var(--primary)", padding: "4px 10px", borderRadius: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
              LIVE ON GALILEO
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 36, alignItems: "center" }}>
            {/* Real Dashboard Verification Matrix Card Mockup */}
            <div style={{
              background: "var(--surface, #121a14)", border: "1px solid rgba(0, 228, 121, 0.3)", borderRadius: 16,
              padding: 24, boxShadow: "0 20px 48px rgba(0,0,0,0.6)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--primary, #00e479)", fontWeight: 700, textTransform: "uppercase" }}>
                    TASK #0 // MULTI-ANNOTATOR MATRIX
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Consensus Quality Distribution</div>
                </div>
                <span className="badge badge-approved" style={{ fontSize: 10 }}>5 / 5 FILLED</span>
              </div>

              {/* Consensus Table */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {[
                  { annotator: "0x0381A8...2DbF45", iou: "0.8071 (80.7%)", share: "3,356 bps (33.5%)", payout: "0.00168 0G", status: "Winner Rank 1" },
                  { annotator: "0x25c268...61002D", iou: "0.7000 (70.0%)", share: "2,911 bps (29.1%)", payout: "0.00145 0G", status: "Approved Rank 2" },
                  { annotator: "0x317987...0C9F28", iou: "0.6634 (66.3%)", share: "2,758 bps (27.6%)", payout: "0.00138 0G", status: "Approved Rank 3" },
                  { annotator: "0x7F9941...8921B0", iou: "0.2350 (23.5%)", share: "0 bps (< 0.30)", payout: "0.00000 0G", status: "Rejected" },
                ].map((row, idx) => (
                  <div key={idx} style={{
                    display: "grid", gridTemplateColumns: "1fr 100px 90px 100px", alignItems: "center",
                    padding: "8px 12px", borderRadius: 8, background: idx < 3 ? "rgba(0, 228, 121, 0.05)" : "rgba(255, 107, 107, 0.05)",
                    border: idx < 3 ? "1px solid rgba(0, 228, 121, 0.2)" : "1px solid rgba(255, 107, 107, 0.2)",
                    fontSize: 12, fontFamily: "'Space Grotesk', monospace",
                  }}>
                    <span style={{ color: "#fff", fontWeight: 600 }}>{row.annotator}</span>
                    <span style={{ color: "#60a5fa" }}>{row.iou}</span>
                    <span style={{ color: "var(--primary, #00e479)", fontWeight: 700 }}>{row.payout}</span>
                    <span style={{ textAlign: "right", color: idx < 3 ? "var(--primary)" : "var(--error)" }}>{row.status}</span>
                  </div>
                ))}
              </div>

              {/* Onchain Settlement Banner */}
              <div style={{ background: "rgba(0, 228, 121, 0.1)", border: "1px solid var(--primary)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary)" }}>check_circle</span>
                  Settled onchain via <code>distributeRewards()</code>
                </span>
                <button className="btn-ghost" onClick={() => navigate("/leaderboard")} style={{ fontSize: 11, padding: "2px 8px", color: "var(--primary)" }}>
                  Leaderboard →
                </button>
              </div>
            </div>

            {/* Description & Link to Dashboard */}
            <div>
              <h3 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 16px" }}>
                Multi-Annotator Consensus & Quality Rewards
              </h3>
              <p style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                Job creators deposit bounties into 0G Galileo smart contract escrows. When annotators submit bounding boxes, the Node.js relayer scores submissions against Ground-Truth and consensus clusters.
              </p>
              <ul style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.8, paddingLeft: 18, margin: "0 0 24px" }}>
                <li><b>Quality Floor:</b> Submissions below 0.30 IoU receive 0 payout share.</li>
                <li><b>Consensus Weighting:</b> Highest-accuracy contributors take proportional basis point shares.</li>
                <li><b>1-Click Creator Override:</b> Customize payout percentages manually from the dashboard.</li>
              </ul>
              <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
                View Creator Dashboard →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. LIVE FEATURE 3: RAPIDCV STUDIO (8-STAGE PIPELINE) ── */}
      <section style={{ padding: "80px 24px", background: "var(--surface, #121a14)", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              END-TO-END AUTONOMOUS AI PIPELINE
            </span>
            <span style={{ fontSize: 11, background: "rgba(0, 228, 121, 0.12)", color: "var(--primary)", border: "1px solid var(--primary)", padding: "4px 10px", borderRadius: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
              LIVE ON GALILEO
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: "#fff" }}>
            RapidCV Studio: Concept to Edge Deployment
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 15, maxWidth: 660, margin: "0 0 36px" }}>
            8-stage autonomous pipeline: Chat with Qwen2.5-Omni → Auto-Label with Moondream VLM → Augment → Pin 0G Dataset → Fine-Tune PyTorch YOLO → Edge Deploy.
          </p>

          {/* 8 Stages Timeline Bar Mockup */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#080c09", border: "1px solid var(--border)", borderRadius: 14,
            padding: "16px 24px", marginBottom: 32, overflowX: "auto", gap: 12,
          }}>
            {[
              { num: "1", label: "Chat Spec", icon: "chat", active: true },
              { num: "2", label: "Collect Data", icon: "dataset", active: true },
              { num: "3", label: "Auto-Label", icon: "auto_awesome", active: true },
              { num: "4", label: "Review & Tag", icon: "rate_review", active: true },
              { num: "5", label: "Augment", icon: "cloud_done", active: true },
              { num: "6", label: "YOLO Train", icon: "memory", active: true },
              { num: "7", label: "Test Sandbox", icon: "biotech", active: false },
              { num: "8", label: "Edge Deploy", icon: "rocket_launch", active: false },
            ].map((st, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: st.active ? "var(--primary, #00e479)" : "rgba(255,255,255,0.06)",
                  color: st.active ? "#000" : "var(--text-3)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900,
                  boxShadow: st.active ? "0 0 10px rgba(0,228,121,0.4)" : "none",
                }}>
                  {st.num}
                </div>
                <span style={{ fontSize: 12, fontWeight: st.active ? 700 : 500, color: st.active ? "#fff" : "var(--text-3)" }}>
                  {st.label}
                </span>
                {i < 7 && <span style={{ color: "var(--border)", marginLeft: 6 }}>→</span>}
              </div>
            ))}
          </div>

          {/* RapidCV Live Training Metrics Showcase */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 32, alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 14px" }}>
                Native PyTorch YOLO Fine-Tuning
              </h3>
              <p style={{ color: "var(--text-2)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                RapidCV fine-tunes custom YOLOv8 models directly on your hardware or 0G Edge compute nodes. Model weights (<code>best.pt</code>) are Merkle-tree hashed and permanently pinned to 0G Decentralized Storage.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn-primary" onClick={() => navigate("/pipeline")}>
                  Open RapidCV Studio →
                </button>
                <button className="btn-secondary" onClick={() => navigate("/models")}>
                  Explore Models
                </button>
              </div>
            </div>

            {/* Metrics Output Card */}
            <div style={{ background: "#080c09", border: "1px solid var(--border)", borderRadius: 14, padding: 22, boxShadow: "0 20px 48px rgba(0,0,0,0.7)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
                <div style={{ background: "var(--surface-low)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>mAP@50</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>94.2%</div>
                </div>
                <div style={{ background: "var(--surface-low)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Precision</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>91.5%</div>
                </div>
                <div style={{ background: "var(--surface-low)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Box Loss</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#ffd700", fontFamily: "'Space Grotesk', monospace" }}>0.042</div>
                </div>
                <div style={{ background: "var(--surface-low)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Epochs</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa", fontFamily: "'Space Grotesk', monospace" }}>30/30</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontFamily: "'Space Grotesk', monospace", color: "var(--text-3)", background: "#050806", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)" }}>
                0G Storage Root: <span style={{ color: "var(--primary)" }}>0x8a92f03...</span> • Model: <b>YOLOv8n Nano</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. COMING SOON: UNIFIED 0G VLM LEADERBOARD ── */}
      <section style={{ padding: "80px 24px", background: "#080c09", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              0G PRIVATE COMPUTE BENCHMARK
            </span>
            <span style={{ fontSize: 11, background: "rgba(167, 139, 250, 0.15)", color: "#c4b5fd", border: "1px solid #a78bfa", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
              COMING SOON
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: "#fff" }}>
            Unified 0G VLM Leaderboard
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 15, maxWidth: 650, margin: "0 0 28px" }}>
            Rankings and vision capabilities of 0G Private Compute models benchmarked across physical vision tasks.
          </p>

          {/* Top Category Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {["Overall", "Object Detection", "Counting", "Identification", "OCR", "Data Extraction", "Reasoning"].map((tab) => {
              const isActive = vlmTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setVlmTab(tab)}
                  style={{
                    background: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.04)",
                    color: isActive ? "#000000" : "rgba(255, 255, 255, 0.65)",
                    border: isActive ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "8px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Sub-filter Bar & Score Key */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 14 }}>
            {/* Filter Pills */}
            <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 3 }}>
              {(["All", "Open", "Closed"] as const).map((filter) => {
                const isActive = vlmFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setVlmFilter(filter)}
                    style={{
                      background: isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
                      color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
                      border: "none",
                      padding: "5px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>

            {/* Score Key */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>
              <span>Score key:</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#00e479", fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e479" }} />
                ≥75%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#84cc16", fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#84cc16" }} />
                40–74%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#ef4444", fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                &lt;40%
              </span>
            </div>
          </div>

          {/* VLM Benchmark Table Container */}
          <div style={{ background: "#0f1310", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 48px rgba(0,0,0,0.7)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#050806", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "rgba(255, 255, 255, 0.6)", fontSize: 12, fontWeight: 600 }}>
                    <th style={{ padding: "14px 18px", width: 60 }}>Rank ↑</th>
                    <th style={{ padding: "14px 18px" }}>Model ↑↓</th>
                    <th style={{ padding: "14px 18px", textAlign: "center" }}>mAP@50 ↑↓</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>mAP@75 ↑↓</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>mAP@50:95 ↑↓</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Tokens / sample ↑↓</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Est. cost / sample ↑↓</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Speed ↑↓</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const dataMap: Record<string, Array<{ rank: number; name: string; icon: string; map50: string; map75: string; map5095: string; tokens: string; cost: string; speed: string; bg: string; color: string }>> = {
                      "Object Detection": [
                        { rank: 1, name: "Qwen3.7 Max", icon: "bolt", map50: "77.1%", map75: "61.4%", map5095: "60.3%", tokens: "3.2K", cost: "$0.013", speed: "30.49s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 2, name: "Claude-Fable 5", icon: "psychology", map50: "70.2%", map75: "56.4%", map5095: "53.7%", tokens: "2.8K", cost: "$0.016", speed: "8.17s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 3, name: "GLM-5.2", icon: "memory", map50: "69.8%", map75: "60.0%", map5095: "56.5%", tokens: "2.2K", cost: "$0.0047", speed: "8.68s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 4, name: "GPT-5.6 Luna", icon: "hub", map50: "68.2%", map75: "46.6%", map5095: "45.2%", tokens: "3.2K", cost: "$0.016", speed: "21.44s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 5, name: "Claude-Opus 4-8", icon: "psychology", map50: "67.6%", map75: "55.8%", map5095: "52.4%", tokens: "1.9K", cost: "$0.010", speed: "8.76s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                      ],
                      "Counting": [
                        { rank: 1, name: "Claude-Fable 5", icon: "psychology", map50: "84.2%", map75: "72.1%", map5095: "69.4%", tokens: "2.1K", cost: "$0.012", speed: "7.82s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 2, name: "Qwen3.7 Max", icon: "bolt", map50: "81.6%", map75: "68.9%", map5095: "66.2%", tokens: "2.9K", cost: "$0.011", speed: "28.10s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 3, name: "GPT-5.6 Luna", icon: "hub", map50: "79.0%", map75: "64.3%", map5095: "61.8%", tokens: "3.0K", cost: "$0.015", speed: "19.30s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 4, name: "GLM-5.2", icon: "memory", map50: "75.4%", map75: "61.0%", map5095: "58.7%", tokens: "2.0K", cost: "$0.0042", speed: "7.90s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 5, name: "Claude-Opus 4-8", icon: "psychology", map50: "73.8%", map75: "59.2%", map5095: "56.0%", tokens: "1.8K", cost: "$0.009", speed: "8.12s", bg: "rgba(132, 204, 22, 0.14)", color: "#84cc16" },
                      ],
                      "Identification": [
                        { rank: 1, name: "Qwen3.7 Max", icon: "bolt", map50: "88.9%", map75: "79.4%", map5095: "76.1%", tokens: "3.4K", cost: "$0.014", speed: "29.40s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 2, name: "GPT-5.6 Luna", icon: "hub", map50: "86.1%", map75: "76.0%", map5095: "73.5%", tokens: "3.1K", cost: "$0.015", speed: "20.10s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 3, name: "Claude-Fable 5", icon: "psychology", map50: "85.4%", map75: "74.8%", map5095: "71.9%", tokens: "2.7K", cost: "$0.015", speed: "8.45s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 4, name: "Claude-Opus 4-8", icon: "psychology", map50: "82.0%", map75: "71.2%", map5095: "68.3%", tokens: "2.0K", cost: "$0.010", speed: "8.90s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                        { rank: 5, name: "GLM-5.2", icon: "memory", map50: "80.6%", map75: "69.5%", map5095: "66.0%", tokens: "2.3K", cost: "$0.0048", speed: "8.80s", bg: "rgba(0, 228, 121, 0.14)", color: "#00e479" },
                      ],
                    };
                    const rows = dataMap[vlmTab] || dataMap["Object Detection"];
                    return rows.map((row) => (
                      <tr key={row.name} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", transition: "background 0.15s ease" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "rgba(255, 255, 255, 0.5)", background: "rgba(255, 255, 255, 0.05)", padding: "3px 8px", borderRadius: 4 }}>
                            {row.rank}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>{row.icon}</span>
                            <span style={{ fontWeight: 700, color: "#ffffff", fontSize: 13.5 }}>{row.name}</span>
                            <button
                              onClick={() => navigate("/pipeline")}
                              style={{
                                background: "rgba(139, 92, 246, 0.15)",
                                border: "1px solid rgba(139, 92, 246, 0.4)",
                                color: "#c4b5fd",
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                marginLeft: 6,
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>rocket_launch</span>
                              Deploy
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <span style={{ background: row.bg, color: row.color, padding: "4px 10px", borderRadius: 4, fontWeight: 700, fontFamily: "'Space Grotesk', monospace" }}>
                            {row.map50}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: "'Space Grotesk', monospace", color: "rgba(255, 255, 255, 0.85)" }}>
                          {row.map75}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: "'Space Grotesk', monospace", color: "rgba(255, 255, 255, 0.85)" }}>
                          {row.map5095}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: "'Space Grotesk', monospace", color: "rgba(255, 255, 255, 0.85)" }}>
                          {row.tokens}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: "'Space Grotesk', monospace", color: "rgba(255, 255, 255, 0.85)" }}>
                          <span style={{ borderBottom: "1px dotted rgba(255, 255, 255, 0.4)", paddingBottom: 1 }}>{row.cost}</span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontFamily: "'Space Grotesk', monospace", color: "rgba(255, 255, 255, 0.85)" }}>
                          {row.speed}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. COMING SOON: ACTIONABLE VISION WORKFLOWS (EVENT TRIGGERS) ── */}
      <section style={{ padding: "80px 24px", background: "var(--surface, #121a14)", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              AUTOMATED REACTION ENGINE
            </span>
            <span style={{ fontSize: 11, background: "rgba(167, 139, 250, 0.15)", color: "#c4b5fd", border: "1px solid #a78bfa", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
              COMING SOON
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: "#fff" }}>
            Actionable Vision Workflows
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 16, maxWidth: 680, margin: "0 0 36px", lineHeight: 1.6 }}>
            Transform raw model predictions into real physical actions. Define visual threshold triggers to activate sirens, pulse industrial relays, or log verifiable on-chain audit records.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 32, alignItems: "center" }}>
            {/* Rule Selector Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { title: "Industrial PPE Safety Violation", trigger: "IF 'no_hardhat' in Zone A > 85% confidence", action: "Trigger Audio Siren + Log Incident to 0G Galileo", icon: "warning" },
                { title: "Assembly Conveyor Defect Ejector", trigger: "IF 'surface_scratch' on Part > 90% confidence", action: "Pulse GPIO Relay Pin to Divert Part to Reject Bin", icon: "precision_manufacturing" },
                { title: "Restricted Perimeter Security", trigger: "IF 'unauthorized_vehicle' detected after hours", action: "Dispatch Webhook Alert + Pin Merkle Proof to 0G", icon: "security" },
              ].map((rule, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveWorkflowRule(idx)}
                  style={{
                    padding: 20, borderRadius: 12, cursor: "pointer", border: "1px solid",
                    borderColor: activeWorkflowRule === idx ? "var(--primary)" : "var(--border)",
                    background: activeWorkflowRule === idx ? "rgba(0, 228, 121, 0.08)" : "#080c09",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: activeWorkflowRule === idx ? "var(--primary)" : "var(--text-3)", fontSize: 20 }}>
                      {rule.icon}
                    </span>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: activeWorkflowRule === idx ? "#fff" : "var(--text-2)" }}>
                      {rule.title}
                    </h4>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "'Space Grotesk', monospace", color: "var(--primary)" }}>{rule.trigger}</div>
                </div>
              ))}
            </div>

            {/* Visual Workflow Canvas Simulation */}
            <div style={{ background: "#080c09", border: "1px solid var(--border)", borderRadius: 16, padding: 26, boxShadow: "0 20px 48px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                  Active Execution Rule #{activeWorkflowRule + 1}
                </span>
                <span style={{ fontSize: 11, background: "rgba(0, 228, 121, 0.15)", color: "var(--primary)", padding: "3px 10px", borderRadius: 12, fontWeight: 700 }}>
                  LIVE TRIGGER ACTIVE
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 4 }}>CONDITION TRIGGER</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {activeWorkflowRule === 0 ? "Target class 'no_hardhat' detected in Camera Stream 1 with confidence >= 85%" : activeWorkflowRule === 1 ? "Target class 'surface_scratch' detected on Conveyor Camera with confidence >= 90%" : "Vehicle detection event outside working hours (20:00 - 06:00)"}
                  </div>
                </div>

                <div style={{ textAlign: "center", color: "var(--primary)", fontSize: 18 }}>↓</div>

                <div style={{ background: "rgba(0, 228, 121, 0.08)", border: "1px solid var(--primary)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "var(--primary)", textTransform: "uppercase", marginBottom: 4 }}>AUTOMATED REACTION ACTION</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {activeWorkflowRule === 0 ? "Activate IoT Floor Alarm (ESP32 Pin 14) + Write Incident Hash to 0G Galileo" : activeWorkflowRule === 1 ? "Trigger Pneumatic Part Ejector (RPi GPIO 23) + Record Flaw Frame" : "Send Webhook Alert + Pin High-Res Audit Snapshot to 0G Storage"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. COMING SOON: PHYSICAL DEVICE & EDGE IOT PIPELINE (ESP32 / RPi) ── */}
      <section style={{ padding: "80px 24px", background: "#080c09", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              EDGE HARDWARE INTEGRATION
            </span>
            <span style={{ fontSize: 11, background: "rgba(167, 139, 250, 0.15)", color: "#c4b5fd", border: "1px solid #a78bfa", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
              COMING SOON
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 36, alignItems: "center" }}>
            {/* Left: Device REST API Payload Mockup */}
            <div style={{ background: "var(--surface, #121a14)", border: "1px solid rgba(0, 228, 121, 0.3)", borderRadius: 16, padding: 22, boxShadow: "0 20px 48px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <span style={{ fontSize: 11, fontFamily: "'Space Grotesk', monospace", color: "var(--primary, #00e479)", fontWeight: 700 }}>
                  POST /api/device/push • ESP32-CAM (WiFi)
                </span>
                <span style={{ fontSize: 10, background: "rgba(0, 228, 121, 0.12)", color: "var(--primary)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                  200 OK • 0G PINNED
                </span>
              </div>
              <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, overflowX: "auto" }}>
                <div>{"{"}</div>
                <div style={{ paddingLeft: 18 }}><span style={{ color: "#60a5fa" }}>"device_id"</span>: <span style={{ color: "#ffd700" }}>"esp32-cam-001"</span>,</div>
                <div style={{ paddingLeft: 18 }}><span style={{ color: "#60a5fa" }}>"location"</span>: <span style={{ color: "#ffd700" }}>"factory-floor-zoneA"</span>,</div>
                <div style={{ paddingLeft: 18 }}><span style={{ color: "#60a5fa" }}>"storage_root_hash"</span>: <span style={{ color: "var(--primary)" }}>"0x9a90f6e1b7..."</span>,</div>
                <div style={{ paddingLeft: 18 }}><span style={{ color: "#60a5fa" }}>"auto_labels"</span>: [{"{"} <span style={{ color: "#60a5fa" }}>"class"</span>: <span style={{ color: "#ffd700" }}>"hardhat"</span>, <span style={{ color: "#60a5fa" }}>"confidence"</span>: <span style={{ color: "var(--primary)" }}>0.984</span> {"}"}],</div>
                <div style={{ paddingLeft: 18 }}><span style={{ color: "#60a5fa" }}>"bounty_job_created"</span>: <span style={{ color: "#ffd700" }}>true</span>,</div>
                <div style={{ paddingLeft: 18 }}><span style={{ color: "#60a5fa" }}>"onchain_job_id"</span>: <span style={{ color: "var(--primary)" }}>3</span></div>
                <div>{"}"}</div>
              </div>
            </div>

            {/* Right: Architecture Points */}
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 14px" }}>
                Physical Device & IoT Vision Pipeline
              </h3>
              <p style={{ color: "var(--text-2)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>
                Turn low-cost $5 ESP32-CAMs, Raspberry Pis, and factory cameras into autonomous data collectors. Devices push raw frames directly to Heda for instant VLM labeling, 0G Storage pinning, and onchain bounty review.
              </p>
              <ul style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.8, paddingLeft: 18, margin: "0 0 24px" }}>
                <li><b>24/7 Field Data Ingestion:</b> Microcontrollers capture frames on motion triggers without manual uploads.</li>
                <li><b>Moondream Edge Auto-Label:</b> Zero-shot VLM annotates bounding boxes automatically in real time.</li>
                <li><b>0G Storage Merkle Verification:</b> Raw camera captures permanently pinned with cryptographic root hashes.</li>
                <li><b>Deploy Back to Edge:</b> Export optimized ONNX/TensorRT weights back to Raspberry Pi or Jetson Nano.</li>
              </ul>
              <button className="btn-secondary" onClick={() => navigate("/pipeline")}>
                Explore RapidCV Pipeline →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. HOW IT WORKS: 5-COLUMN LOOP SECTION ── */}
      <section style={{ padding: "80px 24px", background: "var(--surface, #121a14)", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              HOW HEDA WORKS
            </span>
            <span style={{ fontSize: 11, background: "rgba(167, 139, 250, 0.15)", color: "#c4b5fd", border: "1px solid #a78bfa", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
              COMING SOON
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: "#fff" }}>
            Capture, Train, Deploy & Improve in One Loop
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 15, maxWidth: 660, margin: "0 0 36px", lineHeight: 1.6 }}>
            Heda connects the physical camera line directly to the model. Real sensor data feeds back into training automatically, so your team continuously improves the vision system as it runs.
          </p>

          {/* 5-Column Grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "#080c09",
          }}>
            {[
              { num: "01 / 05", title: "Capture", desc: "Live video or event-driven frames stream from ESP32/RPi cameras into the on-device pipeline.", icon: "videocam" },
              { num: "02 / 05", title: "Label + Train", desc: "Upload to Heda for auto-labeling, Moondream VLM correction, and fine-tuning on 0G.", icon: "model_training" },
              { num: "03 / 05", title: "Workflow", desc: "Assemble models, logic, and integrations in a visual editor, then test the workflow locally.", icon: "schema" },
              { num: "04 / 05", title: "Deploy", desc: "Push workflows to one device or the whole fleet in a single OTA action, with zero downtime.", icon: "publish" },
              { num: "05 / 05", title: "Improve", desc: "Edge cases surface automatically. Retrain in the cloud and redeploy to close the loop.", icon: "autorenew" },
            ].map((col, idx) => (
              <div key={idx} style={{
                padding: "26px 20px 22px",
                borderRight: idx < 4 ? "1px solid var(--border)" : "none",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                background: "#080c09",
              }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--primary, #00e479)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, letterSpacing: "0.06em" }}>
                    {col.num}
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "10px 0 8px" }}>
                    {col.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 24px" }}>
                    {col.desc}
                  </p>
                </div>
                <div>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--primary, #00e479)" }}>
                    {col.icon}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. USE CASES SECTION: 6-CARD GRID ── */}
      <section style={{ padding: "80px 24px", background: "#080c09", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <span style={{ color: "var(--primary, #00e479)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              REAL-WORLD USE CASES
            </span>
            <span style={{ fontSize: 11, background: "rgba(167, 139, 250, 0.15)", color: "#c4b5fd", border: "1px solid #a78bfa", padding: "4px 12px", borderRadius: 20, fontWeight: 700 }}>
              COMING SOON
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: "#fff" }}>
            Built for Problems Where Rules-Based Vision Fails
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 15, maxWidth: 680, margin: "0 0 36px", lineHeight: 1.6 }}>
            Decentralized AI computer vision delivers the image density modern models need to catch subtle differences across lighting, orientation, and real-world SKU variety.
          </p>

          {/* 6-Card Grid (3 Columns x 2 Rows with precise borders) */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "#090f0b",
          }}>
            {[
              { id: "USE CASE A", title: "Variable Defect Detection", desc: "Catch inconsistent or subjective defects that are hard to describe with rules, including scratches, warping, and color drift.", tags: ["MANUFACTURING", "QA", "SURFACE INSPECTION"] },
              { id: "USE CASE B", title: "Complex Assembly Validation", desc: "Validate multi-part assemblies from every orientation. Verify each fastener and each cable route against CAD.", tags: ["ASSEMBLY", "ROBOTICS", "AUTOMOTIVE"] },
              { id: "USE CASE C", title: "Multi-SKU Environments", desc: "Change over without rebuilding logic. Swap workflows across SKUs and lines without rewriting PLC code.", tags: ["CPG", "PACKAGING", "FROZEN GOODS"] },
              { id: "USE CASE D", title: "Context-Aware Pass / Fail", desc: "Combine multiple signals (presence, orientation, color, count) into one decision. Push results to PLC or MES.", tags: ["PLC", "MES", "HMI"] },
              { id: "USE CASE E", title: "Safety + Compliance Monitoring", desc: "Monitor hard hats, safety vests, lockout-tagout, and forklift zones with real-time alerts and structured audit events.", tags: ["EHS", "SAFETY", "COMPLIANCE"] },
              { id: "USE CASE F", title: "Logistics & Smart Inventory", desc: "Track assets across intermodal yards, warehouse docks, and pallets with counts and classifications on every pallet.", tags: ["LOGISTICS", "FREIGHT", "WAREHOUSE"] },
            ].map((uc, i) => {
              const isTopRow = i < 3;
              const isThirdCol = (i % 3) === 2;
              return (
                <div key={i} style={{
                  padding: "28px 24px",
                  borderBottom: isTopRow ? "1px solid var(--border)" : "none",
                  borderRight: !isThirdCol ? "1px solid var(--border)" : "none",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  background: "#090f0b",
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--primary, #00e479)", fontFamily: "'Space Grotesk', monospace", fontWeight: 700, letterSpacing: "0.06em", background: "rgba(0, 228, 121, 0.08)", padding: "3px 8px", borderRadius: 4 }}>
                      {uc.id}
                    </span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "12px 0 8px" }}>
                      {uc.title}
                    </h3>
                    <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 20px" }}>
                      {uc.desc}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {uc.tags.map((t, idx) => (
                      <span key={idx} style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-3)", padding: "3px 7px", borderRadius: 4, fontFamily: "'Space Grotesk', monospace" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 11. NUMBERS & LIVE ONCHAIN STATS ── */}
      <section style={{ padding: "54px 24px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--surface, #121a14)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "var(--primary, #00e479)", fontFamily: "'Space Grotesk', monospace" }}>{stats.totalJobs}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Active Bounty Jobs</div>
          </div>
          <div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#60a5fa", fontFamily: "'Space Grotesk', monospace" }}>{stats.totalDatasets}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Datasets on 0G Storage</div>
          </div>
          <div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#ffd700", fontFamily: "'Space Grotesk', monospace" }}>{stats.activeAnnotators}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Verified Annotators</div>
          </div>
          <div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#a78bfa", fontFamily: "'Space Grotesk', monospace" }}>{stats.modelsTrained}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", marginTop: 4 }}>Trained YOLO Models</div>
          </div>
        </div>
      </section>

      {/* ── 12. CALL TO ACTION BANNER ── */}
      <section style={{ padding: "90px 24px", textAlign: "center", background: "#080c09" }}>
        <div style={{
          maxWidth: 920, margin: "0 auto", padding: "54px 32px", borderRadius: 16,
          background: "var(--surface, #121a14)",
          border: "1px solid var(--border)",
        }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, marginBottom: 14, letterSpacing: "-0.02em", color: "#fff" }}>
            Ready to Build Computer Vision on 0G?
          </h2>
          <p style={{ color: "var(--text-2, #b9cbb9)", fontSize: 16, maxWidth: 620, margin: "0 auto 32px", lineHeight: 1.6 }}>
            Create custom image annotation jobs, fine-tune PyTorch YOLO models, and access decentralized open datasets.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              className="btn-primary"
              onClick={() => navigate("/create")}
              style={{ padding: "13px 30px", fontSize: 15, fontWeight: 700, borderRadius: 8 }}
            >
              Create Annotation Job
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/pipeline")}
              style={{ padding: "13px 26px", fontSize: 15, fontWeight: 700, borderRadius: 8 }}
            >
              Launch RapidCV Studio
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate("/models")}
              style={{ padding: "13px 24px", fontSize: 15, fontWeight: 600, borderRadius: 8 }}
            >
              Explore Model Universe
            </button>
          </div>
        </div>
      </section>

      {/* Marquee Keyframes */}
      <style>{`
        @keyframes scrollLeftMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scrollRightMarquee {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-row-1 {
          animation: scrollLeftMarquee 38s linear infinite;
        }
        .marquee-row-2 {
          animation: scrollRightMarquee 38s linear infinite;
        }
        .marquee-row-1:hover, .marquee-row-2:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
