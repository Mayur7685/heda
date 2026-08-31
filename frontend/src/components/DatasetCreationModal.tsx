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
        backdropFilter: "blur(12px)",
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
          maxWidth: 580,
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
            width: 260,
            height: 110,
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
        <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 13.5, margin: "0 0 28px", maxWidth: 440 }}>
          {currentStep}
        </p>

        {/* ── Visual Animation: Icons & Dotted Flow Lines ── */}
        <div
          style={{
            width: "100%",
            height: 190,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            borderRadius: 14,
            marginBottom: 26,
            overflow: "hidden",
          }}
        >
          {/* Connecting SVG Dotted Flow Lines */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 1,
            }}
            viewBox="0 0 520 190"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="dotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00e479" stopOpacity="0.25" />
                <stop offset="60%" stopColor="#00e479" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#00e479" stopOpacity="1" />
              </linearGradient>
              <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Base static guide dotted paths */}
            <path
              id="pathImage"
              d="M 195 54 C 290 54, 335 95, 410 95"
              fill="none"
              stroke="rgba(0, 228, 121, 0.15)"
              strokeWidth="2"
              strokeDasharray="4 6"
            />
            <path
              id="pathLabels"
              d="M 195 136 C 290 136, 335 95, 410 95"
              fill="none"
              stroke="rgba(0, 228, 121, 0.15)"
              strokeWidth="2"
              strokeDasharray="4 6"
            />

            {/* Slow Animated Dotted Flow Line 1 (Images -> Folder) */}
            <path
              d="M 195 54 C 290 54, 335 95, 410 95"
              fill="none"
              stroke="url(#dotGrad)"
              strokeWidth="2.5"
              strokeDasharray="4 8"
              filter="url(#softGlow)"
              style={{
                animation: "hedaDottedFlow 2.8s linear infinite",
              }}
            />

            {/* Slow Animated Dotted Flow Line 2 (Labels -> Folder) */}
            <path
              d="M 195 136 C 290 136, 335 95, 410 95"
              fill="none"
              stroke="url(#dotGrad)"
              strokeWidth="2.5"
              strokeDasharray="4 8"
              filter="url(#softGlow)"
              style={{
                animation: "hedaDottedFlow 2.8s linear infinite",
              }}
            />

            {/* Slow Moving Glow Pulse 1 along Image line */}
            <circle r="3.5" fill="#00e479" filter="url(#softGlow)">
              <animateMotion
                dur="2.8s"
                repeatCount="indefinite"
                path="M 195 54 C 290 54, 335 95, 410 95"
              />
              <animate
                attributeName="opacity"
                values="0;0.3;1;0.9;0"
                keyTimes="0;0.15;0.7;0.9;1"
                dur="2.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Slow Moving Glow Pulse 2 along Labels line */}
            <circle r="3.5" fill="#00e479" filter="url(#softGlow)">
              <animateMotion
                dur="2.8s"
                repeatCount="indefinite"
                path="M 195 136 C 290 136, 335 95, 410 95"
              />
              <animate
                attributeName="opacity"
                values="0;0.3;1;0.9;0"
                keyTimes="0;0.15;0.7;0.9;1"
                dur="2.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Convergence Merge Point at Folder Entry */}
            <circle cx="410" cy="95" r="4" fill="#00e479" filter="url(#softGlow)">
              <animate
                attributeName="r"
                values="2.5;5;2.5"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          {/* Left Side: Cleanly Aligned Source Nodes */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              width: 175,
              zIndex: 2,
            }}
          >
            {/* Source 1: Images / Text Corpus */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(0, 228, 121, 0.04)",
                border: "1px solid rgba(0, 228, 121, 0.2)",
                borderRadius: 10,
                padding: "8px 12px",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: "rgba(0, 228, 121, 0.1)",
                  border: "1.5px solid rgba(0, 228, 121, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00e479",
                  flexShrink: 0,
                  boxShadow: "0 0 14px rgba(0, 228, 121, 0.2)",
                  animation: "hedaIconPulse 3s ease-in-out infinite",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  {dataType === "text" ? "chat_bubble" : "image"}
                </span>
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                  {dataType === "text" ? "Text Corpus" : "Image Frames"}
                </span>
                <span style={{ display: "block", fontSize: 10.5, color: "rgba(255, 255, 255, 0.45)", whiteSpace: "nowrap" }}>
                  {dataType === "text" ? ".txt / .json" : ".jpg / .png"}
                </span>
              </div>
            </div>

            {/* Source 2: Annotation Labels */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(0, 228, 121, 0.04)",
                border: "1px solid rgba(0, 228, 121, 0.2)",
                borderRadius: 10,
                padding: "8px 12px",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: "rgba(0, 228, 121, 0.1)",
                  border: "1.5px solid rgba(0, 228, 121, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00e479",
                  flexShrink: 0,
                  boxShadow: "0 0 14px rgba(0, 228, 121, 0.2)",
                  animation: "hedaIconPulse 3s ease-in-out infinite 0.7s",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  description
                </span>
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                  Annotation Labels
                </span>
                <span style={{ display: "block", fontSize: 10.5, color: "rgba(255, 255, 255, 0.45)", whiteSpace: "nowrap" }}>
                  COCO / JSONL (.json)
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Destination Dataset Folder (Orbiting Ring Removed) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              zIndex: 2,
              paddingRight: 8,
            }}
          >
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 14,
                background: "radial-gradient(circle at center, rgba(0, 228, 121, 0.25) 0%, rgba(0, 228, 121, 0.08) 100%)",
                border: "2px solid #00e479",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#00e479",
                boxShadow: "0 0 28px rgba(0, 228, 121, 0.35)",
                animation: "hedaFolderGlow 3s ease-in-out infinite alternate",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                folder_zip
              </span>
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
              className="material-symbols-outlined spin"
              style={{
                fontSize: 18,
                color: "var(--primary, #00e479)",
                display: "inline-block",
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
          @keyframes hedaDottedFlow {
            from {
              stroke-dashoffset: 48;
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
              transform: scale(1.04);
              box-shadow: 0 0 18px rgba(0, 228, 121, 0.4);
            }
          }
          @keyframes hedaFolderGlow {
            0% {
              box-shadow: 0 0 18px rgba(0, 228, 121, 0.25);
            }
            100% {
              box-shadow: 0 0 34px rgba(0, 228, 121, 0.55);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
