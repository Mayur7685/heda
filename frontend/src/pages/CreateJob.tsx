import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarketV2 } from "../hooks/useAnnotationMarketV2";
import { uploadBlob, uploadJson, cache0GData } from "../hooks/useStorage";
import { GALILEO } from "../config";

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Configure" },
    { n: 3, label: "Review" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "flex-start" }}>
          {/* Step + label */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 80 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
              background: s.n < current ? "var(--primary)" : "transparent",
              border: `2px solid ${s.n <= current ? "var(--primary)" : "var(--border)"}`,
              color: s.n < current ? "var(--on-primary)" : s.n === current ? "var(--primary)" : "var(--text-3)",
            }}>
              {s.n < current
                ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                : s.n}
            </div>
            <span style={{
              fontSize: 12, fontWeight: s.n === current ? 600 : 400, textAlign: "center",
              color: s.n === current ? "var(--primary)" : "var(--text-3)",
            }}>
              Step {s.n}: {s.label}
            </span>
          </div>
          {/* Connector line between steps */}
          {i < steps.length - 1 && (
            <div style={{
              width: 120, height: 2, marginTop: 15, flexShrink: 0,
              background: s.n < current ? "var(--primary)" : "var(--border)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreateJob() {
  const navigate = useNavigate();
  const { signer, isCorrectChain } = useWallet();
  const marketV2  = useAnnotationMarketV2(signer);

  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [dataType] = useState<0 | 1>(0);
  const [jsonlSchema] = useState<"chat" | "instruction" | "completion">("chat");
  const [instructions, setInstructions] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [rewardPerTask, setRewardPerTask] = useState("0.5");
  const [maxAnnotators, setMaxAnnotators] = useState(5);   // V2: 1-5 annotators per task
  const [status, setStatus] = useState<"idle" | "uploading" | "posting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [uploadedDataRootHash, setUploadedDataRootHash] = useState("");
  const [error, setError] = useState("");
  // Balance check state
  const [balanceWarn, setBalanceWarn] = useState<string | null>(null);

  const totalCost = files.length > 0 ? (parseFloat(rewardPerTask) * files.length).toFixed(2) : "0";

  function addLabel(e: React.KeyboardEvent) {
    if (e.key === "Enter" && labelInput.trim()) {
      setLabels((l) => [...l, labelInput.trim()]);
      setLabelInput("");
    }
  }

  async function handlePost() {
    if (!marketV2 || !signer) {
      setError("V2 Marketplace contract not initialized. Please check wallet connection.");
      return;
    }
    setError("");
    setBalanceWarn(null);

    // Mandatory fields check
    if (files.length === 0 || !instructions.trim() || labels.length === 0 || !rewardPerTask || parseFloat(rewardPerTask) <= 0) {
      setError("All fields are mandatory: Files, Instructions, at least 1 Class Label, and Reward per Task.");
      return;
    }

    // ── Balance pre-check ──────────────────────────────────────────────────
    // Gas buffer: 0.005 ETH covers createJob gas on Galileo (~1M gas × 4 gwei)
    const GAS_BUFFER = 0.005;
    try {
      const balanceBn = await signer.provider!.getBalance(await signer.getAddress());
      const balanceEth = parseFloat(balanceBn.toString()) / 1e18;
      const required = parseFloat(rewardPerTask) * files.length + GAS_BUFFER;
      if (balanceEth < required) {
        setBalanceWarn(
          `Insufficient funds. You need ~${required.toFixed(4)} OG (${(parseFloat(rewardPerTask) * files.length).toFixed(4)} escrow + ${GAS_BUFFER} gas), ` +
          `but your wallet only has ${balanceEth.toFixed(4)} OG. Get testnet funds from the faucet.`
        );
        return;
      }
    } catch { /* skip balance check on provider error */ }

    try {
      setStatus("uploading");
      const fileContents = await Promise.all(
        files.map(async (f) => {
          const buf = await f.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          return { name: f.name, type: f.type, data: btoa(binary) };
        })
      );
      const dataRootHash = await uploadBlob(new Blob([JSON.stringify(fileContents)], { type: "application/json" }));
      cache0GData(dataRootHash, fileContents);
      setUploadedDataRootHash(dataRootHash);
      const metadataRootHash = await uploadJson({ instructions, labels, dataType: dataType === 0 ? "image" : "text", jsonlSchema: dataType === 1 ? jsonlSchema : undefined, fileCount: files.length, dataRootHash });

      setStatus("posting");
      const receipt = await marketV2.createJob(dataRootHash, metadataRootHash, rewardPerTask, files.length, maxAnnotators, dataType);
      setTxHash(receipt.hash);
      setStatus("done");
    } catch (e: any) {
      // Friendly message for the most common error
      const msg: string = e.message ?? "";
      if (msg.includes("insufficient funds")) {
        setError("Insufficient funds — please fund your wallet at faucet.0g.ai and try again.");
      } else {
        setError(msg);
      }
      setStatus("error");
    }
  }

  if (!signer) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 80 }}>
      <p className="hint">Connect your wallet using the button in the top-right corner.</p>
    </div>
  );

  if (!isCorrectChain) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 80 }}>
      <p style={{ color: "var(--error)", fontSize: 13 }}>Please switch to Galileo Testnet (Chain ID 16602) in your wallet.</p>
    </div>
  );

  if (status === "done") return (
    <div className="page" style={{ maxWidth: 640, margin: "0 auto", paddingTop: 40, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 40, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,228,121,0.12)", border: "1px solid rgba(0,228,121,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--primary)" }}>check_circle</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Job Successfully Created!</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 28, maxWidth: 460, margin: "0 auto 28px" }}>
          Your bounty ETH is locked on 0G Galileo. Up to {maxAnnotators} annotators per task can now submit annotations — quality is scored automatically by Moondream IoU and rewards are distributed proportionally.
        </p>
        
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {txHash && (
            <a href={`${GALILEO.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              View Transaction (Chainscan) ↗
            </a>
          )}
          {uploadedDataRootHash && (
            <a href={`${GALILEO.storageExplorer}/file/${uploadedDataRootHash}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
              View 0G Dataset File (Storagescan) ↗
            </a>
          )}
          <button className="btn-secondary" onClick={() => navigate("/jobs")}>
            Browse Active Jobs
          </button>
          <button className="btn-primary" onClick={() => navigate("/dashboard")}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dashboard</span>
            View on Creator Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <StepIndicator current={step} />

      <div className="card" style={{ padding: 32 }}>
        {/* Step 1: Upload */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Upload Image Dataset</h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24 }}>Upload the raw images (PNG, JPG, WEBP) that annotators will label with bounding boxes.</p>

            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed var(--border)", borderRadius: 4, padding: "40px 24px",
              cursor: "pointer", background: "var(--surface)", transition: "border-color 0.15s",
              marginBottom: 16,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--text-3)", marginBottom: 12 }}>upload_file</span>
              <span style={{ color: "var(--text-2)", fontSize: 14 }}>
                {files.length > 0 ? `${files.length} file(s) selected` : "Drop image files here or click to browse"}
              </span>
              <span className="hint" style={{ marginTop: 4 }}>
                PNG, JPG, WEBP • Max 10MB per file
              </span>
              <input type="file" multiple accept="image/*"
                style={{ display: "none" }} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>

            {files.length > 0 && (
              <div style={{ background: "var(--primary-bg)", border: "1px solid rgba(0,228,121,0.3)", borderRadius: 4, padding: "8px 12px", fontSize: 13, color: "var(--primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>check_circle</span>
                {files.length} file(s) ready — {files.length} image annotation tasks will be created
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn-primary" onClick={() => setStep(2)} disabled={files.length === 0}>
                Continue to Configure <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
          </>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
              Image Bounding Box Config
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24 }}>
              Define instructions and bounding box class labels for annotators.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {dataType === 1 && (
                <div style={{ background: "var(--primary-bg)", border: "1px solid rgba(0,228,121,0.3)", borderRadius: 4, padding: "10px 14px", fontSize: 13 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 6, color: "var(--primary)" }}>schema</span>
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>Output schema: {jsonlSchema === "chat" ? "Chat Messages" : jsonlSchema === "instruction" ? "Instruction" : "Text Completion"}</span>
                  <span style={{ color: "var(--text-2)", marginLeft: 8 }}>— annotator labels will be formatted as {jsonlSchema === "chat" ? '{"messages": [...]}' : jsonlSchema === "instruction" ? '{"instruction": ..., "output": ...}' : '{"text": ...}'}</span>
                </div>
              )}

              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>
                  {dataType === 0 ? "Annotation Instructions" : "Task Instructions"}
                </label>
                <textarea rows={4}
                  placeholder={dataType === 0
                    ? "Draw bounding boxes around all vehicles. Label each box: car, truck, or bus."
                    : "Read each text and classify its sentiment as positive, negative, or neutral."}
                  value={instructions} onChange={(e) => setInstructions(e.target.value)}
                  style={{ resize: "vertical" }} />
              </div>

              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>
                  {dataType === 0 ? "Bounding Box Classes" : "Classification Labels"}
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, minHeight: 44 }}>
                  {labels.map((l) => (
                    <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--surface-high)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: 13 }}>
                      {l}
                      <button onClick={() => setLabels((prev) => prev.filter((x) => x !== l))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 14, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  <input type="text"
                    placeholder={dataType === 0 ? "Add class… (e.g. car)" : "Add label… (e.g. positive)"}
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)} onKeyDown={addLabel}
                    style={{ border: "none", background: "transparent", outline: "none", minWidth: 100, padding: "2px 4px", fontSize: 13 }} />
                </div>
                <p className="hint" style={{ marginTop: 4 }}>
                  {dataType === 0
                    ? "Press Enter to add each class. Annotators will use these as bbox labels."
                    : "Press Enter to add each label. Annotators will pick one per text."}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Reward Per Task</label>
                  <div style={{ position: "relative" }}>
                    <input type="number" step="0.1" min="0.001" value={rewardPerTask}
                      onChange={(e) => setRewardPerTask(e.target.value)} />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 13 }}>0G</span>
                  </div>
                </div>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Estimated Total Cost</label>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px" }}>
                    <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>{totalCost} 0G</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      {files.length} tasks × {rewardPerTask} 0G = {totalCost} 0G total locked
                    </div>
                  </div>
                </div>
              </div>

              {/* V2: Max Annotators per Task */}
              {marketV2 && (
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Max Annotators per Task</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input type="range" min={1} max={5} step={1} value={maxAnnotators}
                      onChange={(e) => setMaxAnnotators(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--primary)" }} />
                    <span style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 700, fontSize: 18, color: "var(--primary)", minWidth: 16, textAlign: "center" }}>{maxAnnotators}</span>
                  </div>
                  <p className="hint" style={{ marginTop: 4 }}>Up to {maxAnnotators} annotators submit per task. Best quality earns highest share.</p>
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.25)", color: "var(--primary)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
                    Moondream IoU Auto-Eval
                  </div>
                </div>
              )}

              {labels.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--error)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                  At least 1 {dataType === 0 ? "bounding box class label" : "classification label"} is required.
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button className="btn-secondary" onClick={() => setStep(1)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Back
              </button>
              <button className="btn-primary" onClick={() => setStep(3)}
                disabled={!instructions.trim() || labels.length === 0 || !rewardPerTask || parseFloat(rewardPerTask) <= 0}>
                Continue to Review <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
          </>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Review & Post</h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24 }}>Review your job configuration before posting onchain.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginBottom: 24 }}>
              {([
                ["Data Type", dataType === 0 ? "Image" : "Text"],
                ["Files / Tasks", `${files.length} tasks`],
                ["Instructions", instructions || "—"],
                ["Labels", labels.length > 0 ? labels.join(", ") : "—"],
                ["Reward per Task", `${rewardPerTask} 0G`],
                ["Total Locked", `${totalCost} 0G`],
                ...(marketV2 ? [
                  ["Max Annotators/Task", `${maxAnnotators} (open submission)`],
                  ["Evaluation Method", "⚡ Moondream IoU Auto-Eval"],
                ] : []),
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 16, background: "var(--surface-low)", padding: "12px 16px" }}>
                  <span className="label-caps" style={{ minWidth: 160 }}>{k}</span>
                  <span style={{ color: k === "Evaluation Method" ? "var(--primary)" : "var(--text)", fontSize: 14, fontWeight: k === "Evaluation Method" ? 600 : 400 }}>{v}</span>
                </div>
              ))}
            </div>

            {error && <div className="tx-banner error" style={{ marginBottom: 16 }}>{error}</div>}

            {/* Balance warning — shown before user clicks Post */}
            {balanceWarn && (
              <div style={{
                marginBottom: 16, padding: "12px 16px", borderRadius: 6,
                background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.35)",
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#ffd700", flexShrink: 0, marginTop: 1 }}>
                  account_balance_wallet
                </span>
                <div>
                  <p style={{ fontSize: 13, color: "#ffd700", fontWeight: 600, marginBottom: 4 }}>
                    Insufficient Wallet Balance
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 8 }}>
                    {balanceWarn}
                  </p>
                  <a
                    href="https://faucet.0g.ai"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 12, fontWeight: 700, color: "#ffd700",
                      border: "1px solid rgba(255,215,0,0.4)",
                      padding: "4px 10px", borderRadius: 4,
                      background: "rgba(255,215,0,0.1)",
                      textDecoration: "none",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                    Get testnet OG from faucet.0g.ai
                  </a>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn-secondary" onClick={() => setStep(2)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Back
              </button>
              <button className="btn-primary" onClick={handlePost}
                disabled={status === "uploading" || status === "posting"}>
                {status === "uploading" ? "Uploading to 0G Storage…" :
                 status === "posting" ? "Posting onchain…" :
                 `Post Job (lock ${totalCost} 0G)`}
                {status === "idle" && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>}
              </button>
            </div>
          </>
        )}

      </div>

      {/* Job Upload & Onchain Escrow Telemetry Progress Modal */}
      {(status === "uploading" || status === "posting" || (status === "error" && Boolean(error))) && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: 24
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 32, maxWidth: 480, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.8)"
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              {status === "error" ? (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--error)" }}>error</span>
                </div>
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,228,121,0.12)", border: "1px solid rgba(0,228,121,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined spin" style={{ fontSize: 24, color: "var(--primary)" }}>progress_activity</span>
                </div>
              )}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  {status === "error" ? "Job Creation Failed" : status === "uploading" ? "Uploading Dataset to 0G Storage" : "Locking Bounty Onchain"}
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-3)", margin: "2px 0 0 0" }}>
                  {status === "error" ? "An error occurred during submission" : status === "uploading" ? `Serializing & pinning ${files.length} file(s) to 0G Merkle Nodes` : "Please confirm the transaction in MetaMask"}
                </p>
              </div>
            </div>

            {/* Step Telemetry Tracker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: status === "error" ? 20 : 0 }}>
              {/* Step 1: 0G Storage Image Upload */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
                background: status === "uploading" ? "rgba(96,165,250,0.08)" : "var(--surface-high)",
                border: status === "uploading" ? "1px solid rgba(96,165,250,0.3)" : "1px solid var(--border)"
              }}>
                {status === "uploading" ? (
                  <span className="material-symbols-outlined spin" style={{ fontSize: 18, color: "#60a5fa" }}>progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>check_circle</span>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>0G Storage Dataset Upload</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {status === "uploading" ? `Uploading ${files.length} images to 0G Turbo Indexer...` : "Dataset pinned to 0G Storage Merkle Tree ✓"}
                  </div>
                </div>
              </div>

              {/* Step 2: Metadata & Label Pinning */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
                background: status === "posting" ? "rgba(0,228,121,0.08)" : "var(--surface-high)",
                border: status === "posting" ? "1px solid rgba(0,228,121,0.3)" : "1px solid var(--border)"
              }}>
                {status === "uploading" ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-3)" }}>radio_button_unchecked</span>
                ) : status === "posting" ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>check_circle</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-3)" }}>radio_button_unchecked</span>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Metadata & Class Labels</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {status === "uploading" ? "Waiting for dataset upload..." : "Job instructions & class labels pinned to 0G ✓"}
                  </div>
                </div>
              </div>

              {/* Step 3: Onchain Smart Contract Escrow */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
                background: status === "posting" ? "rgba(255,215,0,0.08)" : "var(--surface-high)",
                border: status === "posting" ? "1px solid rgba(255,215,0,0.3)" : "1px solid var(--border)"
              }}>
                {status === "posting" ? (
                  <span className="material-symbols-outlined spin" style={{ fontSize: 18, color: "#ffd700" }}>progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-3)" }}>radio_button_unchecked</span>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>0G Galileo Testnet Escrow</div>
                  <div style={{ fontSize: 11, color: status === "posting" ? "#ffd700" : "var(--text-3)" }}>
                    {status === "posting" ? "Check MetaMask — confirm bounty transaction" : `Locking ${totalCost} 0G in escrow`}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message & Retry */}
            {status === "error" && (
              <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: 14, color: "var(--error)", fontSize: 13 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
                <button
                  className="btn-secondary btn-sm"
                  style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                  onClick={() => setStatus("idle")}
                >
                  Dismiss & Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
