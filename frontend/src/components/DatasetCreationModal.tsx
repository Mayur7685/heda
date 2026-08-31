interface DatasetCreationModalProps {
  isOpen: boolean;
  currentStep?: string;
  subStatus?: string;
  dataType?: "image" | "text";
}

export default function DatasetCreationModal({
  isOpen,
  currentStep = "Merging Image and Annotation files into dataset…",
  subStatus = "Uploading & pinning archive to 0G Storage network…",
  dataType = "image",
}: DatasetCreationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 7, 5, 0.88)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Modal Container */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(14, 22, 17, 0.98) 0%, rgba(6, 12, 9, 0.98) 100%)",
          border: "1px solid rgba(0, 228, 121, 0.28)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.85), 0 0 40px rgba(0, 228, 121, 0.12)",
          borderRadius: 16,
          maxWidth: 560,
          width: "100%",
          padding: "36px 32px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top subtle glow */}
        <div
          style={{
            position: "absolute",
            top: -50,
            left: "50%",
            transform: "translateX(-50%)",
            width: 240,
            height: 100,
            background: "radial-gradient(ellipse at center, rgba(0, 228, 121, 0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Modal Title & Subtitle */}
        <span
          className="label-caps"
          style={{
            color: "var(--primary, #00e479)",
            fontSize: 11,
            letterSpacing: "0.14em",
            marginBottom: 6,
          }}
        >
          0G Decentralized Storage Pipeline
        </span>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#fff", letterSpacing: "-0.02em" }}>
          Generating Dataset Package
        </h2>
        <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 13.5, margin: "0 0 28px", maxWidth: 420 }}>
          {currentStep}
        </p>

        {/* ── Visual Animation: Icons & Connecting Lines ── */}
        <div
          style={{
            width: "100%",
            height: 180,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 30px",
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 12,
            marginBottom: 26,
            overflow: "hidden",
          }}
        >
          {/* Connecting SVG Flow Lines */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
            viewBox="0 0 496 180"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00e479" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#00e479" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00e479" stopOpacity="0.9" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Base guide paths */}
            <path
              d="M 85 55 C 220 55, 260 90, 410 90"
              fill="none"
              stroke="rgba(0, 228, 121, 0.15)"
              strokeWidth="2"
            />
            <path
              d="M 85 125 C 220 125, 260 90, 410 90"
              fill="none"
              stroke="rgba(0, 228, 121, 0.15)"
              strokeWidth="2"
            />

            {/* Animated Flowing Line 1 (Images -> Folder) */}
            <path
              d="M 85 55 C 220 55, 260 90, 410 90"
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              filter="url(#glow)"
              style={{
                animation: "hedaFlowDash 1.2s linear infinite",
              }}
            />

            {/* Animated Flowing Line 2 (Annotations Text -> Folder) */}
            <path
              d="M 85 125 C 220 125, 260 90, 410 90"
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              filter="url(#glow)"
              style={{
                animation: "hedaFlowDash 1.2s linear infinite",
              }}
            />

            {/* Convergence Merge Pulse Point */}
            <circle cx="280" cy="90" r="4" fill="#00e479" filter="url(#glow)">
              <animate
                attributeName="r"
                values="3;6;3"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          {/* Left Side: Source Icons (Images & Txt Files) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
              alignItems: "center",
              zIndex: 2,
            }}
          >
            {/* Source 1: Image Icon */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  background: "rgba(0, 228, 121, 0.08)",
                  border: "1.5px solid rgba(0, 228, 121, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00e479",
                  boxShadow: "0 0 16px rgba(0, 228, 121, 0.2)",
                  animation: "hedaIconPulse 2s ease-in-out infinite",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                  {dataType === "text" ? "chat_bubble" : "image"}
                </span>
              </div>
              <div style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {dataType === "text" ? "Text Corpus" : "Image Frames"}
                </span>
                <span style={{ display: "block", fontSize: 10.5, color: "rgba(255, 255, 255, 0.45)" }}>
                  {dataType === "text" ? ".txt / .json" : ".jpg / .png"}
                </span>
              </div>
            </div>

            {/* Source 2: Annotation Text / Label Icon */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  background: "rgba(0, 228, 121, 0.08)",
                  border: "1.5px solid rgba(0, 228, 121, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00e479",
                  boxShadow: "0 0 16px rgba(0, 228, 121, 0.2)",
                  animation: "hedaIconPulse 2s ease-in-out infinite 0.5s",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                  description
                </span>
              </div>
              <div style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  Annotation Labels
                </span>
                <span style={{ display: "block", fontSize: 10.5, color: "rgba(255, 255, 255, 0.45)" }}>
                  COCO / JSONL (.json)
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Output Destination Icon (Dataset Folder) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 14,
                background: "radial-gradient(circle at center, rgba(0, 228, 121, 0.22) 0%, rgba(0, 228, 121, 0.06) 100%)",
                border: "2px solid #00e479",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#00e479",
                boxShadow: "0 0 28px rgba(0, 228, 121, 0.35)",
                position: "relative",
                animation: "hedaFolderGlow 2.5s ease-in-out infinite alternate",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                folder_zip
              </span>

              {/* Orbiting ring */}
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: 18,
                  border: "1px dashed rgba(0, 228, 121, 0.5)",
                  animation: "hedaSpin 8s linear infinite",
                  pointerEvents: "none",
                }}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
                0G Dataset
              </span>
              <span style={{ display: "block", fontSize: 10.5, color: "#00e479", fontWeight: 600 }}>
                Merged Package
              </span>
            </div>
          </div>
        </div>

        {/* Step Progress Info */}
        <div
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(0, 228, 121, 0.05)",
            border: "1px solid rgba(0, 228, 121, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text, #fff)" }}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 18,
                color: "var(--primary, #00e479)",
                animation: "hedaSpin 1.5s linear infinite",
              }}
            >
              progress_activity
            </span>
            <span style={{ fontWeight: 500 }}>{subStatus}</span>
          </div>
          <span style={{ fontFamily: "'Space Grotesk', monospace", color: "var(--primary, #00e479)", fontWeight: 700 }}>
            Syncing…
          </span>
        </div>

        {/* Keyframe Styles */}
        <style>{`
          @keyframes hedaFlowDash {
            from {
              stroke-dashoffset: 28;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          @keyframes hedaIconPulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 12px rgba(0, 228, 121, 0.2);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 20px rgba(0, 228, 121, 0.4);
            }
          }
          @keyframes hedaFolderGlow {
            0% {
              box-shadow: 0 0 20px rgba(0, 228, 121, 0.25);
            }
            100% {
              box-shadow: 0 0 36px rgba(0, 228, 121, 0.55);
            }
          }
          @keyframes hedaSpin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
