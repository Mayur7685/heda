import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { GALILEO } from "../config";

export default function DatasetDetail() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const { signer, address } = useWallet();
  const registry = useDatasetRegistry(signer);
  const [dataset, setDataset] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [hasLicense, setHasLicense] = useState(false);
  const [txMsg, setTxMsg] = useState("");
  const [txErr, setTxErr] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!registry || !datasetId) return;
    loadDataset();
  }, [!!registry, datasetId]);

  async function loadDataset() {
    if (!registry || !datasetId) return;
    const d = await registry.getDataset(Number(datasetId));
    setDataset(d);
    if (address) setHasLicense(await registry.hasLicense(Number(datasetId), address));
    const res = await fetch(`${GALILEO.storageIndexer}/file?root=${d.metadataURI}`).catch(() => null);
    if (res?.ok) setMetadata(await res.json());
  }

  async function purchase() {
    if (!registry || !dataset) return;
    setTxMsg("Purchasing…"); setTxErr(false);
    try {
      const receipt = await registry.purchase(Number(datasetId), ethers.formatEther(dataset.price));
      setTxMsg(`Purchased ✓ — ${GALILEO.explorer}/tx/${receipt.hash}`);
      setHasLicense(true);
    } catch (e: any) { setTxMsg(e.message); setTxErr(true); }
  }

  async function download() {
    if (!dataset) return;
    setDownloading(true);
    try {
      const res = await fetch(`${GALILEO.storageIndexer}/file?root=${dataset.rootHash}`);
      if (!res.ok) throw new Error("File not found on 0G Storage");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `heda-dataset-${datasetId}-coco.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setTxMsg(e.message); setTxErr(true); }
    finally { setDownloading(false); }
  }

      if (!dataset) return <div className="page"><p className="hint">Loading…</p></div>;

  const price = ethers.formatEther(dataset.price);
  const isFree = dataset.price === 0n;

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <button onClick={() => navigate("/datasets")} className="btn-ghost" style={{ padding: "4px 0" }}>
          <span className="label-caps">Datasets</span>
        </button>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>chevron_right</span>
        <span className="label-caps" style={{ color: "var(--text-2)" }}>
          {metadata?.name || `Dataset #${datasetId}`}
        </span>
      </div>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, background: "var(--primary-bg)", border: "1px solid rgba(0,228,121,0.2)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>{Number(dataset.dataType) === 0 ? "image" : "article"}</span>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{metadata?.name || `Dataset #${datasetId}`}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="badge badge-verified">0G-NATIVE</span>
            <span className="badge badge-verified">VERIFIED</span>
          </div>
        </div>
      </div>

      {txMsg && <div className={`tx-banner ${txErr ? "error" : ""}`} style={{ marginBottom: 24 }}>
        {txMsg.includes("http") ? <><span>{txMsg.split(" — ")[0]} — </span><a href={txMsg.split(" — ")[1]} target="_blank" rel="noreferrer">View tx ↗</a></> : txMsg}
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        {/* Left: metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Description */}
          {metadata?.description && (
            <div>
              <span className="label-caps" style={{ display: "block", marginBottom: 8 }}>About Dataset</span>
              <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>{metadata.description}</p>
            </div>
          )}

          {/* Attributes table */}
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Data Type", Number(dataset.dataType) === 0 ? "Image" : "Text"],
                  ["Publisher Address", <span className="mono-tag">{dataset.publisher.slice(0, 10)}…{dataset.publisher.slice(-6)}</span>],
                  metadata?.labels && ["Classes", <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{metadata.labels.map((l: string) => <span key={l} className="badge badge-verified">{l}</span>)}</div>],
                  metadata?.taskCount && ["Total Tasks", `${metadata.taskCount} Annotations`],
                  ["Root Hash", <a href={GALILEO.storageExplorer} target="_blank" rel="noreferrer" style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--primary)" }}>{dataset.rootHash.slice(0, 20)}…{dataset.rootHash.slice(-8)}</a>],
                  dataset.sourceJobId > 0 && ["Source Job", `#${Number(dataset.sourceJobId)}`],
                ].filter(Boolean).map(([k, v]: any) => (
                  <tr key={k}>
                    <td style={{ color: "var(--text-3)", width: 200 }}>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: action card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Price card */}
          <div className="card" style={{ padding: 20 }}>
            <span className="label-caps" style={{ display: "block", marginBottom: 8 }}>Commercial Access</span>
            <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 36, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              {isFree ? "FREE" : price}
              {!isFree && <span style={{ fontSize: 18, color: "var(--text-2)", marginLeft: 6 }}>0G</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
              {[
                ["verified_user", "Full Commercial Usage Rights"],
                ["cloud_download", "Immediate 0G Storage Access"],
                ["update", "Free Metadata Updates (1 Year)"],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary)" }}>{icon}</span>
                  {text}
                </div>
              ))}
            </div>

            {hasLicense ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span className="badge badge-approved" style={{ fontSize: 12 }}>Licensed</span>
                </div>
                <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={download} disabled={downloading}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                  {downloading ? "Downloading…" : "Download Dataset"}
                </button>
              </>
            ) : (
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={purchase}>
                {isFree ? "Get Free" : `Buy for ${price} 0G`}
              </button>
            )}
            <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>Gas fees apply in 0G token</p>
          </div>

          {/* Provenance card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-3)" }}>account_tree</span>
              <span className="label-caps">Data Provenance</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Root Hash", dataset.rootHash.slice(0, 12) + "…"],
                ["Network", "0G Galileo Testnet"],
                ["Protocol", "Heda v1.0"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-3)" }}>{k}</span>
                  <span style={{ fontFamily: "'Space Grotesk', monospace", color: "var(--text-2)" }}>{v}</span>
                </div>
              ))}
            </div>
            <a href={`${GALILEO.explorer}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, color: "var(--primary)", fontSize: 13 }}>
              View on 0G Explorer
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
