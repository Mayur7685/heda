import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";
import { uploadBlob, uploadJson } from "../hooks/useStorage";
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
  const { signer, isCorrectChain } = useWallet();
  const market = useAnnotationMarket(signer);

  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [dataType, setDataType] = useState<0 | 1>(0);
  const [jsonlSchema, setJsonlSchema] = useState<"chat" | "instruction" | "completion">("chat");
  const [instructions, setInstructions] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [rewardPerTask, setRewardPerTask] = useState("0.5");
  const [status, setStatus] = useState<"idle" | "uploading" | "posting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const totalCost = files.length > 0 ? (parseFloat(rewardPerTask) * files.length).toFixed(2) : "0";

  function addLabel(e: React.KeyboardEvent) {
    if (e.key === "Enter" && labelInput.trim()) {
      setLabels((l) => [...l, labelInput.trim()]);
      setLabelInput("");
    }
  }

  async function handlePost() {
    if (!market || !signer) return;
    setError("");
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
      const metadataRootHash = await uploadJson({ instructions, labels, dataType: dataType === 0 ? "image" : "text", jsonlSchema: dataType === 1 ? jsonlSchema : undefined, fileCount: files.length, dataRootHash });

      setStatus("posting");
      const receipt = await market.createJob(dataRootHash, metadataRootHash, rewardPerTask, files.length, dataType);
      setTxHash(receipt.hash);
      setStatus("done");
    } catch (e: any) {
      setError(e.message);
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
    <div className="page" style={{ textAlign: "center", paddingTop: 80 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--primary)", display: "block", marginBottom: 16 }}>check_circle</span>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Job Created</h2>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>Your annotation job is live on Galileo.</p>
      <a href={`${GALILEO.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ marginRight: 12 }}>View Tx ↗</a>
      <a href="/" className="btn-primary">Browse Jobs</a>
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <StepIndicator current={step} />

      <div className="card" style={{ padding: 32 }}>
        {/* Step 1: Upload */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Upload Dataset</h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24 }}>Upload the raw data files that annotators will label.</p>

            {/* Data type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {([0, 1] as const).map((t) => (
                <button key={t} onClick={() => setDataType(t)}
                  style={{
                    padding: "6px 20px", borderRadius: 4, border: "1px solid",
                    borderColor: dataType === t ? "var(--primary)" : "var(--border)",
                    background: dataType === t ? "var(--primary-bg)" : "transparent",
                    color: dataType === t ? "var(--primary)" : "var(--text-2)",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>
                    {t === 0 ? "image" : "article"}
                  </span>
                  {t === 0 ? "Images" : "Text"}
                </button>
              ))}
            </div>

            {/* JSONL schema selector — only for text */}
            {dataType === 1 && (
              <div style={{ marginBottom: 20 }}>
                <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Output Schema (for fine-tuning)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {([
                    { key: "chat", label: "Chat Messages", example: '{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}', desc: "Recommended — works with all 0G models" },
                    { key: "instruction", label: "Instruction", example: '{"instruction": "...", "input": "...", "output": "..."}', desc: "For instruction-following tasks" },
                    { key: "completion", label: "Text Completion", example: '{"text": "..."}', desc: "For generative/completion tasks" },
                  ] as const).map(({ key, label, example, desc }) => (
                    <div key={key} onClick={() => setJsonlSchema(key)}
                      style={{
                        padding: "10px 14px", borderRadius: 4, cursor: "pointer",
                        border: `1px solid ${jsonlSchema === key ? "var(--primary)" : "var(--border)"}`,
                        background: jsonlSchema === key ? "var(--primary-bg)" : "var(--surface)",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${jsonlSchema === key ? "var(--primary)" : "var(--border)"}`, background: jsonlSchema === key ? "var(--primary)" : "transparent", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: jsonlSchema === key ? "var(--primary)" : "var(--text)" }}>{label}</span>
                        <span className="hint">{desc}</span>
                      </div>
                      <code style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'Space Grotesk', monospace" }}>{example}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed var(--border)", borderRadius: 4, padding: "40px 24px",
              cursor: "pointer", background: "var(--surface)", transition: "border-color 0.15s",
              marginBottom: 16,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--text-3)", marginBottom: 12 }}>upload_file</span>
              <span style={{ color: "var(--text-2)", fontSize: 14 }}>
                {files.length > 0 ? `${files.length} file(s) selected` : "Drop files here or click to browse"}
              </span>
              <span className="hint" style={{ marginTop: 4 }}>
                {dataType === 0 ? "PNG, JPG, WEBP" : "TXT, JSONL, JSON"}
              </span>
              <input type="file" multiple accept={dataType === 0 ? "image/*" : ".txt,.jsonl,.json"}
                style={{ display: "none" }} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>

            {files.length > 0 && (
              <div style={{ background: "var(--primary-bg)", border: "1px solid rgba(0,228,121,0.3)", borderRadius: 4, padding: "8px 12px", fontSize: 13, color: "var(--primary)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>check_circle</span>
                {files.length} file(s) ready — {files.length} annotation tasks will be created
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
              {dataType === 0 ? "Image Annotation Config" : "Text Annotation Config"}
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24 }}>
              {dataType === 0
                ? "Define what annotators should label and how much they earn per image."
                : "Define the classification task and output schema for fine-tuning."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Text: show selected schema as reminder */}
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
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button className="btn-secondary" onClick={() => setStep(1)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Back
              </button>
              <button className="btn-primary" onClick={() => setStep(3)} disabled={!instructions.trim()}>
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
              {[
                ["Data Type", dataType === 0 ? "Image" : "Text"],
                ["Files / Tasks", `${files.length} tasks`],
                ["Instructions", instructions || "—"],
                ["Labels", labels.length > 0 ? labels.join(", ") : "—"],
                ["Reward per Task", `${rewardPerTask} 0G`],
                ["Total Locked", `${totalCost} 0G`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 16, background: "var(--surface-low)", padding: "12px 16px" }}>
                  <span className="label-caps" style={{ minWidth: 140 }}>{k}</span>
                  <span style={{ color: "var(--text)", fontSize: 14 }}>{v}</span>
                </div>
              ))}
            </div>

            {error && <div className="tx-banner error" style={{ marginBottom: 16 }}>{error}</div>}

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
    </div>
  );
}
