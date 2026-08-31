import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useDeviceRegistry, type DeviceInfo, type IngestedFrame } from "../hooks/useDeviceRegistry";
import { GALILEO, CONTRACTS, RELAYER_API_URL } from "../config";

export default function Devices() {
  const { address, signer } = useWallet();
  const deviceRegistry = useDeviceRegistry(signer);

  const [myDevices, setMyDevices] = useState<DeviceInfo[]>([]);
  const [deviceFrameCounts, setDeviceFrameCounts] = useState<Record<string, number>>({});
  const [recentFrames, setRecentFrames] = useState<IngestedFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPairModal, setShowPairModal] = useState(false);

  // Form states
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    loadData();
  }, [address, deviceRegistry]);

  async function loadData() {
    if (!deviceRegistry) return;
    setLoading(true);
    try {
      if (address) {
        const devs = await deviceRegistry.getOwnerDevices(address);
        setMyDevices(devs);

        // Fetch exact frame count per device from API and aggregate owner frames
        const counts: Record<string, number> = {};
        let ownerFrames: IngestedFrame[] = [];
        for (const dev of devs) {
          const dFrames = await deviceRegistry.fetchDeviceFrames(dev.deviceId, 100);
          counts[dev.deviceId] = dFrames.length;
          ownerFrames = ownerFrames.concat(dFrames);
        }
        setDeviceFrameCounts(counts);
        // Sort and limit to 5 most recent frames strictly from this owner's hardware
        ownerFrames.sort((a, b) => b.timestamp - a.timestamp);
        setRecentFrames(ownerFrames.slice(0, 5));
      } else {
        setMyDevices([]);
        setRecentFrames([]);
        setDeviceFrameCounts({});
      }
    } catch (e: any) {
      console.error("Failed to load device data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handlePairDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceRegistry || !newDeviceId.trim()) return;
    setPairBusy(true);
    setStatusMsg("Confirming device pairing on 0G Galileo...");
    setIsError(false);

    try {
      await deviceRegistry.pairDevice(newDeviceId.trim(), newDeviceName.trim() || "ESP32 Vision Node");
      setStatusMsg(`✓ Device ${newDeviceId} successfully paired to your wallet!`);
      setNewDeviceId("");
      setNewDeviceName("");
      setTimeout(() => {
        setShowPairModal(false);
        setStatusMsg("");
        loadData();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`Pairing failed: ${err.reason || err.message}`);
      setIsError(true);
    } finally {
      setPairBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,228,121,0.1)", border: "1px solid rgba(0,228,121,0.3)", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "var(--primary)", fontWeight: 600, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>photo_camera</span>
            Physical IoT & Edge Camera Fleet
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: "#fff" }}>Connected Edge Hardware</h1>
          <p style={{ color: "#9ca3af", margin: "8px 0 0 0", fontSize: 14 }}>
            Manage physical ESP32-CAM, Raspberry Pi, and Jetson nodes streaming directly to 0G Storage & Galileo.
          </p>
        </div>

        <button
          onClick={() => setShowPairModal(true)}
          style={{
            background: "var(--primary)",
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: "12px 20px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Pair New Camera
        </button>
      </div>

      {/* Contract Badge Info */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 20px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00e479", boxShadow: "0 0 10px #00e479" }} />
          <span style={{ fontSize: 13, color: "#d1d5db" }}>
            DeviceRegistry Contract: <a href={`${GALILEO.explorer}/address/${CONTRACTS.DEVICE_REGISTRY}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontFamily: "monospace", textDecoration: "underline" }}>{CONTRACTS.DEVICE_REGISTRY}</a>
          </span>
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>0G Galileo Testnet (Chain ID 16602)</span>
      </div>

      {/* My Paired Devices */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 16 }}>My Paired Cameras</h2>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading hardware devices...</div>
        ) : myDevices.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--text-3)", marginBottom: 12, display: "block" }}>videocam_off</span>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: "0 0 8px 0" }}>No Cameras Paired Yet</h3>
            <p style={{ color: "#9ca3af", fontSize: 13, maxWidth: 460, margin: "0 auto 20px auto" }}>
              Pair your first ESP32-CAM or edge node to start streaming frames to 0G Storage and creating on-chain bounty jobs.
            </p>
            <button
              onClick={() => setShowPairModal(true)}
              style={{ background: "rgba(0,228,121,0.15)", color: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 6, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Pair Camera Now
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {myDevices.map((dev) => (
              <div
                key={dev.deviceId}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: "0 0 4px 0" }}>{dev.deviceName}</h3>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--primary)" }}>{dev.deviceId}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: dev.active ? "rgba(0,228,121,0.15)" : "rgba(239,68,68,0.15)", color: dev.active ? "#00e479" : "#ef4444", fontWeight: 600 }}>
                      {dev.active ? "Active" : "Offline"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "16px 0", background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: "#9ca3af" }}>Frames Ingested</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                        {deviceFrameCounts[dev.deviceId] ?? dev.totalFramesIngested}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#9ca3af" }}>Assigned Model</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{dev.assignedModelId > 0 ? `Model #${dev.assignedModelId}` : "None"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Link
                    to={`/devices/${encodeURIComponent(dev.deviceId)}`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      background: "rgba(0,228,121,0.1)",
                      border: "1px solid rgba(0,228,121,0.3)",
                      color: "var(--primary)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Open Gallery & Bounties →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Owner's Streamed Frames Stream */}
      {recentFrames.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>My Camera Frame Stream</h2>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Live Ingest Queue (Latest 5 frames from your paired cameras)</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {recentFrames.map((f) => (
              <div key={f.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ height: 130, background: "#0a0a0a", borderRadius: 6, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
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
                  <div style={{ fontSize: 11, color: "var(--primary)", fontFamily: "monospace", marginBottom: 4 }}>{f.device_id}</div>
                  <div style={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {f.root_hash.slice(0, 10)}...{f.root_hash.slice(-6)}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{(f.size_bytes / 1024).toFixed(1)} KB</span>
                  <a href={`https://storagescan-galileo.0g.ai/root/${f.root_hash}`} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>
                    0G Explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pair Device Modal */}
      {showPairModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, width: "100%", maxWidth: 480, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Pair ESP32 Camera</h3>
              <button onClick={() => setShowPairModal(false)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handlePairDevice}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Device ID (Factory MAC Address)</label>
                <input
                  type="text"
                  placeholder="e.g. ESP32-94:E6:86:12:AB:CD"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  required
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#fff", fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }}
                />
                <span style={{ fontSize: 11, color: "#9ca3af", display: "block", marginTop: 4 }}>Printed on your ESP32-CAM module or visible in serial logs.</span>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Camera Nickname</label>
                <input
                  type="text"
                  placeholder="e.g. Factory Floor Node 1"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              {statusMsg && (
                <div style={{ padding: "10px 14px", borderRadius: 6, fontSize: 12, marginBottom: 16, background: isError ? "rgba(239,68,68,0.15)" : "rgba(0,228,121,0.15)", color: isError ? "#ef4444" : "#00e479" }}>
                  {statusMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  style={{ background: "#222", border: "none", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pairBusy}
                  style={{ background: "var(--primary)", border: "none", color: "#000", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pairBusy ? "not-allowed" : "pointer" }}
                >
                  {pairBusy ? "Pairing on Chain..." : "Pair Camera"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
