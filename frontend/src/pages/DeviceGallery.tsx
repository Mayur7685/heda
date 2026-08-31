import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useDeviceRegistry, type DeviceInfo, type IngestedFrame } from "../hooks/useDeviceRegistry";
import { useAnnotationMarketV2 } from "../hooks/useAnnotationMarketV2";
import { uploadBlob, uploadJson, cache0GData } from "../hooks/useStorage";
import { GALILEO, RELAYER_API_URL } from "../config";

export default function DeviceGallery() {
  const { deviceId: rawDeviceId } = useParams();
  const deviceId = decodeURIComponent(rawDeviceId || "");
  const navigate = useNavigate();

  const { address, signer } = useWallet();
  const deviceRegistry = useDeviceRegistry(signer);
  const marketV2 = useAnnotationMarketV2(signer);

  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [frames, setFrames] = useState<IngestedFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoots, setSelectedRoots] = useState<Set<string>>(new Set());

  // Bounty Creation Modal states (matching CreateJob design system)
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [rewardPerTask, setRewardPerTask] = useState("0.5");
  const [maxAnnotators, setMaxAnnotators] = useState(5);
  const [status, setStatus] = useState<"idle" | "uploading" | "posting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [balanceWarn, setBalanceWarn] = useState<string | null>(null);

  const selectedCount = selectedRoots.size;
  const totalCost = selectedCount > 0 ? (parseFloat(rewardPerTask || "0") * selectedCount).toFixed(3) : "0";

  useEffect(() => {
    loadDeviceData();
  }, [deviceId, deviceRegistry]);

  async function loadDeviceData() {
    if (!deviceRegistry || !deviceId) return;
    setLoading(true);
    try {
      const dev = await deviceRegistry.getDevice(deviceId);
      setDevice(dev);
      const devFrames = await deviceRegistry.fetchDeviceFrames(deviceId, 100);
      setFrames(devFrames);
    } catch (e: any) {
      console.error("Error loading device gallery:", e);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(root: string) {
    setSelectedRoots((prev) => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  }

  function selectAll() {
    if (selectedRoots.size === frames.length) {
      setSelectedRoots(new Set());
    } else {
      setSelectedRoots(new Set(frames.map((f) => f.root_hash)));
    }
  }

  function addLabel(e: React.KeyboardEvent) {
    if (e.key === "Enter" && labelInput.trim()) {
      e.preventDefault();
      if (!labels.includes(labelInput.trim())) {
        setLabels((l) => [...l, labelInput.trim()]);
      }
      setLabelInput("");
    }
  }

  async function handleCreateBounty() {
    if (!marketV2 || !signer || selectedRoots.size === 0) {
      setError("Marketplace contract not ready or no frames selected.");
      return;
    }
    setError("");
    setBalanceWarn(null);

    if (!instructions.trim() || labels.length === 0 || !rewardPerTask || parseFloat(rewardPerTask) <= 0) {
      setError("All fields are mandatory: Instructions, at least 1 Class Label, and Reward per Task.");
      return;
    }

    // Balance pre-check (reward + gas buffer)
    const GAS_BUFFER = 0.005;
    try {
      const balanceBn = await signer.provider!.getBalance(await signer.getAddress());
      const balanceEth = parseFloat(balanceBn.toString()) / 1e18;
      const required = parseFloat(rewardPerTask) * selectedCount + GAS_BUFFER;
      if (balanceEth < required) {
        setBalanceWarn(
          `Insufficient funds. You need ~${required.toFixed(4)} 0G (${(parseFloat(rewardPerTask) * selectedCount).toFixed(4)} escrow + ${GAS_BUFFER} gas), but your wallet has ${balanceEth.toFixed(4)} 0G. Get testnet funds from faucet.0g.ai.`
        );
        return;
      }
    } catch { /* skip balance check on provider error */ }

    try {
      setStatus("uploading");
      const selectedList = Array.from(selectedRoots);

      // 1. Fetch binary buffers from relayer proxy and package for Annotator Workspace
      const fileContents = await Promise.all(
        selectedList.map(async (rootHash, idx) => {
          try {
            const resp = await fetch(`${RELAYER_API_URL}/file?root=${rootHash}`);
            if (resp.ok) {
              const blob = await resp.blob();
              const buf = await blob.arrayBuffer();
              const bytes = new Uint8Array(buf);
              let binary = "";
              for (let i = 0; i < bytes.length; i += 8192) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
              }
              return { name: `frame_${idx + 1}.jpg`, type: "image/jpeg", data: btoa(binary), rootHash };
            }
          } catch {}
          return { name: `frame_${idx + 1}.jpg`, type: "image/jpeg", data: "", rootHash };
        })
      );

      const dataRootHash = await uploadBlob(new Blob([JSON.stringify(fileContents)], { type: "application/json" }));
      cache0GData(dataRootHash, fileContents);

      // 2. Upload metadata URI
      const metadataRootHash = await uploadJson({
        instructions,
        labels,
        dataType: "image",
        fileCount: selectedList.length,
        dataRootHash,
        hardwareDeviceId: deviceId,
        source: "Edge Camera Stream",
      });

      // 3. Create on-chain bounty job on AnnotationMarketV2
      setStatus("posting");
      const receipt = await marketV2.createJob(
        dataRootHash,
        metadataRootHash,
        rewardPerTask,
        selectedList.length,
        maxAnnotators,
        0 // dataType 0 = Image
      );

      setTxHash(receipt.hash);
      setStatus("done");
    } catch (e: any) {
      console.error("Bounty creation failed:", e);
      const msg: string = e.message ?? "";
      if (msg.includes("insufficient funds")) {
        setError("Insufficient funds — please fund your wallet with testnet 0G from faucet.0g.ai and try again.");
      } else {
        setError(msg || "Failed to create bounty job on Galileo.");
      }
    }
  }

  // Camera Admin Privacy Guard: Only the paired wallet owner can view private stream
  if (device && device.owner && device.owner !== "0x0000000000000000000000000000000000000000" && address && address.toLowerCase() !== device.owner.toLowerCase()) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
        <div className="card" style={{ padding: 40 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--error)", marginBottom: 16 }}>lock</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Private Hardware Stream</h2>
          <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            This edge camera is paired on-chain to wallet <code style={{ color: "var(--primary)" }}>{device.owner.slice(0, 6)}…{device.owner.slice(-4)}</code>. Switch to the owner wallet to access this camera stream or deploy bounties.
          </p>
          <Link to="/devices" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Back to My Cameras
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      {/* Back Link */}
      <Link to="/devices" style={{ color: "var(--text-3)", textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> Back to All Cameras
      </Link>

      {/* Header Info */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24, marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text)" }}>{device?.deviceName || deviceId}</h1>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(0,228,121,0.15)", color: "var(--primary)", fontWeight: 600 }}>
              Live 0G Node
            </span>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--primary)" }}>{deviceId}</div>
          <div style={{ color: "var(--text-2)", fontSize: 12, marginTop: 4 }}>
            Total Frames Streamed: <strong style={{ color: "var(--text)" }}>{frames.length}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn-primary"
            onClick={() => {
              setStatus("idle");
              setError("");
              setShowBountyModal(true);
            }}
            disabled={selectedRoots.size === 0}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: selectedRoots.size > 0 ? "pointer" : "not-allowed",
              opacity: selectedRoots.size > 0 ? 1 : 0.5,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
            Create Bounty Job ({selectedRoots.size} Selected)
          </button>
        </div>
      </div>

      {/* Gallery Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 }}>Streamed Frames ({frames.length})</h2>
        <button
          className="btn-secondary"
          onClick={selectAll}
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          {selectedRoots.size === frames.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Frames Gallery Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-3)" }}>Loading camera frames from 0G Storage...</div>
      ) : frames.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: 60, textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--text-3)", marginBottom: 12, display: "block" }}>sensors</span>
          <h3 style={{ fontSize: 16, color: "var(--text)", margin: "0 0 8px 0" }}>No Frames Ingested Yet</h3>
          <p style={{ color: "var(--text-3)", fontSize: 13, maxWidth: 460, margin: "0 auto" }}>
            Power on your ESP32-CAM and connect it to your Wi-Fi. As it captures images, they will automatically pin to 0G Storage and appear here in real time!
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {frames.map((f) => {
            const isSelected = selectedRoots.has(f.root_hash);
            return (
              <div
                key={f.id}
                onClick={() => toggleSelect(f.root_hash)}
                style={{
                  background: isSelected ? "rgba(0,228,121,0.06)" : "var(--surface)",
                  border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(f.timestamp).toLocaleTimeString()}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: "pointer", accentColor: "var(--primary)" }}
                    />
                  </div>

                  <div style={{ height: 160, background: "#0a0a0a", borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <img
                      src={`${RELAYER_API_URL}/file?root=${f.root_hash}`}
                      alt="0G Frame"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes("indexer-storage-testnet-turbo")) {
                          target.src = `https://indexer-storage-testnet-turbo.0g.ai/file?root=${f.root_hash}`;
                        }
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--primary)", wordBreak: "break-all" }}>
                    {f.root_hash.slice(0, 12)}...{f.root_hash.slice(-8)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
                    <span>{(f.size_bytes / 1024).toFixed(1)} KB</span>
                    <a
                      href={`https://storagescan-galileo.0g.ai/root/${f.root_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--primary)", textDecoration: "underline" }}
                    >
                      0G Explorer
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create 0G Bounty Job Configuration Modal ─────────── */}
      {showBountyModal && status !== "done" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 620, padding: 32, maxHeight: "90vh", overflowY: "auto" }}>
            
            {/* Modal Title Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>
                  Image Bounding Box Config
                </h2>
                <p style={{ color: "var(--text-2)", fontSize: 13, margin: 0 }}>
                  Define instructions and bounding box class labels for {selectedCount} selected edge camera frame(s).
                </p>
              </div>
              <button onClick={() => setShowBountyModal(false)} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Annotation Instructions */}
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Annotation Instructions</label>
                <textarea
                  rows={4}
                  placeholder="Draw bounding boxes around all vehicles. Label each box: car, truck, or bus."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Bounding Box Classes Pill Tag System */}
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Bounding Box Classes</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, minHeight: 44 }}>
                  {labels.map((l) => (
                    <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--surface-high)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: 13 }}>
                      {l}
                      <button
                        type="button"
                        onClick={() => setLabels((prev) => prev.filter((x) => x !== l))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 14, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add class… (e.g. car)"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={addLabel}
                    style={{ border: "none", background: "transparent", outline: "none", minWidth: 120, padding: "2px 4px", fontSize: 13 }}
                  />
                </div>
                <p className="hint" style={{ marginTop: 4 }}>
                  Press Enter to add each class. Annotators will use these as bbox labels.
                </p>
              </div>

              {/* Reward per Task & Total Escrow Locked */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Reward Per Task</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0.001"
                      value={rewardPerTask}
                      onChange={(e) => setRewardPerTask(e.target.value)}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 13 }}>0G</span>
                  </div>
                </div>
                <div>
                  <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Estimated Total Cost</label>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px" }}>
                    <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{totalCost} 0G</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      {selectedCount} tasks × {rewardPerTask} 0G = {totalCost} 0G total locked
                    </div>
                  </div>
                </div>
              </div>

              {/* Max Annotators per Task Range Slider */}
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: 8 }}>Max Annotators per Task</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={maxAnnotators}
                    onChange={(e) => setMaxAnnotators(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 700, fontSize: 18, color: "var(--primary)", minWidth: 16, textAlign: "center" }}>{maxAnnotators}</span>
                </div>
                <p className="hint" style={{ marginTop: 4 }}>Up to {maxAnnotators} annotators submit per task. Best quality earns highest share.</p>
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "rgba(0,228,121,0.08)", border: "1px solid rgba(0,228,121,0.25)", color: "var(--primary)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
                  Moondream IoU Auto-Eval
                </div>
              </div>

              {/* Warnings & Errors */}
              {balanceWarn && (
                <div style={{ padding: "10px 14px", borderRadius: 4, background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.35)", color: "#ffb400", fontSize: 12 }}>
                  {balanceWarn}
                </div>
              )}

              {error && (
                <div className="tx-banner error" style={{ margin: 0 }}>
                  {error}
                </div>
              )}
            </div>

            {/* Modal Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button className="btn-secondary" onClick={() => setShowBountyModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateBounty}
                disabled={!instructions.trim() || labels.length === 0 || !rewardPerTask || parseFloat(rewardPerTask) <= 0}
                style={{ minWidth: 180, justifyContent: "center" }}
              >
                Post Job (lock {totalCost} 0G)
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginLeft: 6 }}>arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Job Upload & Onchain Escrow Telemetry Progress Modal (Identical to CreateJob.tsx) ─────────── */}
      {(status === "uploading" || status === "posting" || (status === "error" && Boolean(error))) && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.85)",
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
                  {status === "error" ? "An error occurred during submission" : status === "uploading" ? `Packaging & pinning ${selectedCount} camera frames to 0G Merkle Nodes` : "Please confirm the transaction in MetaMask"}
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>0G Storage Dataset Manifest</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {status === "uploading" ? `Uploading ${selectedCount} camera frames to 0G Turbo Indexer...` : "Dataset pinned to 0G Storage Merkle Tree ✓"}
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

            {/* Error Message & Dismiss */}
            {status === "error" && (
              <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: 14, color: "var(--error)", fontSize: 13, marginTop: 16 }}>
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

      {/* ── Job Success Modal (Identical to CreateJob.tsx) ─────────── */}
      {status === "done" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: 20 }}>
          <div className="card" style={{ maxWidth: 640, width: "100%", padding: 40, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,228,121,0.12)", border: "1px solid rgba(0,228,121,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--primary)" }}>check_circle</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Job Successfully Created!</h2>
            <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 28, maxWidth: 460, margin: "0 auto 28px" }}>
              Your bounty 0G is locked on 0G Galileo. Up to {maxAnnotators} annotators per task can now submit annotations — quality is scored automatically by Moondream IoU and rewards are distributed proportionally.
            </p>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {txHash && (
                <a href={`${GALILEO.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                  View Transaction (Chainscan) ↗
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
      )}
    </div>
  );
}
