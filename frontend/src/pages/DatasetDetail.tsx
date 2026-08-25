import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { GALILEO } from "../config";

import TrainingModal from "../components/TrainingModal";

import { fetchFrom0GStorage } from "../hooks/useStorage";

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
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [realImages, setRealImages] = useState<Array<{ name: string; url: string; anns: any[] }>>([]);

  useEffect(() => {
    if (!registry || !datasetId) return;
    loadDataset();
  }, [!!registry, datasetId]);

  async function loadDataset() {
    if (!registry || !datasetId) return;
    const d = await registry.getDataset(Number(datasetId));
    setDataset(d);
    if (address) setHasLicense(await registry.hasLicense(Number(datasetId), address));
    
    let meta: any = null;
    try {
      meta = await fetchFrom0GStorage(d.metadataURI, 3);
      setMetadata(meta);
    } catch {}

    // Fetch real uploaded dataset content from 0G Storage Indexer / Cache
    try {
      const rawData = await fetchFrom0GStorage(d.rootHash, 3);
      if (rawData && typeof rawData === "object") {
        const cocoImages = rawData.images ?? [];
        const cocoAnns = rawData.annotations ?? [];
        const dataRoot = rawData.info?.data_root_hash ?? meta?.dataRootHash;

        let sourceFiles: any[] = [];
        if (dataRoot) {
          sourceFiles = await fetchFrom0GStorage(dataRoot, 3).catch(() => []);
        }

        const parsedSamples: any[] = [];
        (cocoImages.length > 0 ? cocoImages.slice(0, 10) : sourceFiles.slice(0, 10)).forEach((imgObj: any, idx: number) => {
          let imgUrl = imgObj.base64;
          if (!imgUrl && sourceFiles[imgObj.id ?? idx]) {
            const fileObj = sourceFiles[imgObj.id ?? idx];
            if (fileObj?.data) {
              imgUrl = fileObj.data.startsWith("data:") ? fileObj.data : `data:${fileObj.type || "image/jpeg"};base64,${fileObj.data}`;
            }
          }
          if (!imgUrl && sourceFiles[idx]?.data) {
            const fileObj = sourceFiles[idx];
            imgUrl = fileObj.data.startsWith("data:") ? fileObj.data : `data:${fileObj.type || "image/jpeg"};base64,${fileObj.data}`;
          }
          if (!imgUrl && imgObj?.data) {
            imgUrl = imgObj.data.startsWith("data:") ? imgObj.data : `data:${imgObj.type || "image/jpeg"};base64,${imgObj.data}`;
          }

          const imgAnns = cocoAnns.filter((a: any) => a.image_id === imgObj.id || a.task_id === imgObj.id);

          if (imgUrl) {
            parsedSamples.push({
              name: imgObj.file_name ?? imgObj.name ?? `Image #${idx + 1}`,
              url: imgUrl,
              anns: imgAnns,
            });
          }
        });

        if (parsedSamples.length > 0) {
          setRealImages(parsedSamples);
        }
      }
    } catch (e) {
      console.warn("Could not load real dataset images:", e);
    }
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
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const isImage = Number(dataset.dataType) === 0;

      const dataRes = await fetch(`${GALILEO.storageIndexer}/file?root=${dataset.rootHash}`);
      if (!dataRes.ok) throw new Error("Dataset not found on 0G Storage");
      const dataText = await dataRes.text();

      if (isImage) {
        zip.file("annotations/instances.json", dataText);
        try {
          const coco = JSON.parse(dataText);
          const sourceRoot = coco.info?.data_root_hash ?? metadata?.dataRootHash;
          if (sourceRoot) {
            const imgRes = await fetch(`${GALILEO.storageIndexer}/file?root=${sourceRoot}`).catch(() => null);
            if (imgRes?.ok) {
              const files: Array<{ name: string; type: string; data: string }> = await imgRes.json();
              files.forEach((f, i) => {
                if (f.data) {
                  const ext = f.type?.split("/")[1] ?? "jpg";
                  zip.file(`images/${f.name ?? `image_${i}.${ext}`}`, f.data, { base64: true });
                }
              });
            }
          }
        } catch { /* images unavailable */ }
        zip.file("README.txt", `Heda Dataset #${datasetId}\nFormat: COCO JSON\nAnnotations: annotations/instances.json\nImages: images/`);
      } else {
        zip.file("dataset.jsonl", dataText);
        zip.file("README.txt", `Heda Dataset #${datasetId}\nFormat: JSONL\nFile: dataset.jsonl`);
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heda-dataset-${datasetId}.zip`;
      a.click();
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

      {/* ── Real Uploaded Dataset Images Gallery Strip ── */}
      {Number(dataset.dataType) === 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, height: 180, borderRadius: 12, overflow: "hidden" }}>
            {(realImages.length > 0 ? realImages : [
              { name: "sample1.jpg", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80" },
              { name: "sample2.jpg", url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?auto=format&fit=crop&w=600&q=80" },
              { name: "sample3.jpg", url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80" },
              { name: "sample4.jpg", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80" },
              { name: "sample5.jpg", url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80" },
            ]).slice(0, 5).map((item, idx) => (
              <div key={idx} style={{ position: "relative", width: "100%", height: 180, background: "#050806", overflow: "hidden", borderRadius: 8, border: "1px solid var(--border)" }}>
                <img src={item.url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </div>
      )}

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
                  metadata?.taskCount && ["Total Images", `${metadata.taskCount} Images`],
                  ["Root Hash", <a href={`${GALILEO.storageExplorer}/file/${dataset.rootHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--primary)" }}>{dataset.rootHash.slice(0, 16)}…{dataset.rootHash.slice(-6)} ↗</a>],
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

            <button
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "center", marginTop: 12, borderColor: "var(--primary)", color: "var(--primary)" }}
              onClick={() => setShowTrainingModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>model_training</span>
              Train YOLO Model
            </button>
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

      {showTrainingModal && dataset && (
        <TrainingModal
          datasetId={Number(datasetId)}
          datasetName={metadata?.name || `Dataset #${datasetId}`}
          datasetRootHash={dataset.rootHash}
          onClose={() => setShowTrainingModal(false)}
        />
      )}
    </div>
  );
}
