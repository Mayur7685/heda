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
    if (!datasetId) return;
    let d: any = null;
    if (registry) {
      try {
        const [fetchedDataset, allDatasets] = await Promise.all([
          registry.getDataset(Number(datasetId)).catch(() => null),
          registry.listDatasets().catch(() => []),
        ]);
        const match = Array.isArray(allDatasets) ? allDatasets.find((item: any) => Number(item.datasetId) === Number(datasetId)) : null;
        const rawPublisher = fetchedDataset?.publisher ?? match?.publisher ?? fetchedDataset?.[0];

        if (rawPublisher && rawPublisher !== "0x0000000000000000000000000000000000000000") {
          d = {
            publisher: rawPublisher,
            rootHash: fetchedDataset?.rootHash ?? match?.rootHash ?? fetchedDataset?.[1],
            metadataURI: fetchedDataset?.metadataURI ?? match?.metadataURI ?? fetchedDataset?.[2],
            price: fetchedDataset?.price ?? (match?.price ? ethers.parseEther(String(match.price)) : 0n),
            dataType: Number(fetchedDataset?.dataType ?? match?.dataType ?? fetchedDataset?.[4] ?? 0),
            sourceJobId: Number(fetchedDataset?.sourceJobId ?? match?.sourceJobId ?? fetchedDataset?.[5] ?? 0),
            txHash: match?.txHash || "",
          };
          setDataset(d);
          if (address) setHasLicense(await registry.hasLicense(Number(datasetId), address));
        } else {
          d = null;
        }
      } catch {
        d = null;
      }
    }

    // Fallback: check localStorage custom datasets if not found on-chain
    if (!d) {
      try {
        const stored = localStorage.getItem("hedaprotocol_custom_datasets");
        if (stored) {
          const list = JSON.parse(stored);
          const found = list.find((x: any) => String(x.datasetId) === String(datasetId));
          if (found) {
            d = {
              publisher: found.publisher ?? "0x0000000000000000000000000000000000000000",
              rootHash: found.rootHash,
              metadataURI: found.metadataURI ?? "",
              price: found.price ? ethers.parseEther(String(found.price)) : 0n,
              dataType: found.dataType ?? 0,
              sourceJobId: found.sourceJobId ?? 0,
              active: true,
            };
            setDataset(d);
            setMetadata({
              name: found.name ?? `Custom Dataset #${datasetId}`,
              format: found.format ?? "COCO JSON",
              taskCount: found.taskCount ?? 1,
              labels: found.labels ?? ["object"],
              dataRootHash: found.dataRootHash,
            });
            setHasLicense(true);
          }
        }
      } catch {}
    }

    let meta: any = null;
    if (d && d.metadataURI) {
      try {
        meta = await fetchFrom0GStorage(d.metadataURI, 3);
        if (meta) setMetadata(meta);
      } catch {}
    }

    // Fetch real uploaded dataset content from 0G Storage Indexer / Cache
    if (d && d.rootHash) {
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
  }

  async function purchase() {
    if (!registry || !dataset) return;
    setTxMsg("Purchasing…"); setTxErr(false);
    try {
      const priceEth = typeof dataset.price === "bigint" ? ethers.formatEther(dataset.price) : String(dataset.price || "0");
      const receipt = await registry.purchase(Number(datasetId), priceEth);
      setTxMsg(`Purchased ✓ — ${GALILEO.explorer}/tx/${receipt.hash}`);
      setHasLicense(true);
    } catch (e: any) { setTxMsg(e.message); setTxErr(true); }
  }

  async function download() {
    if (!dataset) return;
    setDownloading(true);
    setTxMsg("Packaging dataset files…"); setTxErr(false);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const isImage = Number(dataset.dataType) === 0;

      // Fetch COCO JSON or JSONL data via resilient fetchFrom0GStorage
      let rawData = await fetchFrom0GStorage(dataset.rootHash, 5).catch(() => null);

      // Fallback: try raw HTTP fetch from 0G Storage Indexer
      if (!rawData) {
        const res = await fetch(`${GALILEO.storageIndexer}/file?root=${dataset.rootHash}`).catch(() => null);
        if (res?.ok) {
          const txt = await res.text();
          try { rawData = JSON.parse(txt); } catch { rawData = txt; }
        }
      }

      if (!rawData) throw new Error("Dataset files not found on 0G Storage");

      if (isImage) {
        const cocoObj = typeof rawData === "object" ? rawData : JSON.parse(String(rawData));
        
        // 1. Save COCO annotations file
        zip.file("annotations/instances.json", JSON.stringify(cocoObj, null, 2));

        // 2. Extract and zip images directly from 0G Storage payloads
        const imagesList: any[] = Array.isArray(cocoObj.images) ? cocoObj.images : [];
        let addedImages = 0;

        // Step A: Extract base64 images directly from COCO images array
        imagesList.forEach((imgObj: any, idx: number) => {
          let b64 = imgObj.base64 ?? imgObj.data ?? imgObj.url ?? imgObj.b64;
          if (b64 && typeof b64 === "string") {
            const cleanB64 = b64.includes(",") ? b64.split(",")[1] : b64;
            const fileName = imgObj.file_name ?? imgObj.name ?? `image_${idx + 1}.jpg`;
            zip.file(`images/${fileName}`, cleanB64, { base64: true });
            addedImages++;
          }
        });

        // Step B: Fetch source image files from 0G Storage data_root_hash
        const sourceRoot = cocoObj.info?.data_root_hash ?? metadata?.dataRootHash ?? dataset?.dataRootHash ?? dataset?.sourceDataRootHash;
        if (sourceRoot) {
          try {
            const sourceData: any = await fetchFrom0GStorage(sourceRoot, 5).catch(() => null);
            const sourceFiles: any[] = Array.isArray(sourceData)
              ? sourceData
              : sourceData && typeof sourceData === "object"
              ? Object.values(sourceData)
              : [];

            sourceFiles.forEach((f: any, idx: number) => {
              let b64 = f?.data ?? f?.base64 ?? f?.url;
              if (b64 && typeof b64 === "string") {
                const cleanB64 = b64.includes(",") ? b64.split(",")[1] : b64;
                const fileName = f.name ?? f.file_name ?? (imagesList[idx]?.file_name) ?? `image_${idx + 1}.jpg`;
                if (!zip.file(`images/${fileName}`)) {
                  zip.file(`images/${fileName}`, cleanB64, { base64: true });
                  addedImages++;
                }
              }
            });
          } catch (err) {
            console.warn("Could not fetch source image files from 0G Storage:", err);
          }
        }

        zip.file(
          "README.txt",
          `Heda Dataset #${datasetId}\nFormat: COCO JSON\nAnnotations: annotations/instances.json\nImages Included: ${addedImages}\nPublisher: ${dataset.publisher}`
        );
      } else {
        const content = typeof rawData === "string" ? rawData : JSON.stringify(rawData, null, 2);
        zip.file("dataset.jsonl", content);
        zip.file("README.txt", `Heda Dataset #${datasetId}\nFormat: JSONL\nFile: dataset.jsonl`);
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heda-dataset-${datasetId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setTxMsg(`Dataset #${datasetId} downloaded successfully! ✓`);
    } catch (e: any) {
      setTxMsg(`Download error: ${e.message}`);
      setTxErr(true);
    } finally {
      setDownloading(false);
    }
  }

  if (!dataset) return <div className="page"><p className="hint">Loading…</p></div>;

  let price = "0";
  let isFree = true;
  try {
    if (dataset.price !== null && dataset.price !== undefined) {
      if (typeof dataset.price === "bigint") {
        price = ethers.formatEther(dataset.price);
        isFree = dataset.price === 0n;
      } else if (typeof dataset.price === "string") {
        price = dataset.price.includes(".") ? dataset.price : ethers.formatEther(dataset.price);
        isFree = parseFloat(price) === 0;
      } else if (typeof dataset.price === "number") {
        price = String(dataset.price);
        isFree = dataset.price === 0;
      }
    }
  } catch {
    price = "0";
    isFree = true;
  }

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
                  ["Publisher Address", dataset.publisher ? <span className="mono-tag">{dataset.publisher.slice(0, 10)}…{dataset.publisher.slice(-6)}</span> : "—"],
                  metadata?.labels && ["Classes", <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{metadata.labels.map((l: string) => <span key={l} className="badge badge-verified">{l}</span>)}</div>],
                  metadata?.taskCount && ["Total Images", `${metadata.taskCount} Images`],
                  ["Root Hash", dataset.rootHash ? <span className="mono-tag" title={dataset.rootHash}>{dataset.rootHash.slice(0, 16)}…{dataset.rootHash.slice(-6)}</span> : "—"],
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

            {hasLicense || isFree || (address && dataset.publisher && address.toLowerCase() === dataset.publisher.toLowerCase()) ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span className="badge badge-approved" style={{ fontSize: 12 }}>
                    {hasLicense ? "Purchased License ✓" : isFree ? "Free Dataset Access" : "Publisher Owner ✓"}
                  </span>
                </div>
                <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14 }} onClick={download} disabled={downloading}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                  {downloading ? "Building & Downloading Zip…" : "Download Dataset (.zip)"}
                </button>
              </>
            ) : (
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14 }} onClick={purchase}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shopping_cart</span>
                Buy License for {price} 0G
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
                ["Root Hash", dataset.rootHash ? dataset.rootHash.slice(0, 12) + "…" : "—"],
                ["Network", "0G Galileo Testnet"],
                ["Protocol", "Heda v1.0"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-3)" }}>{k}</span>
                  <span style={{ fontFamily: "'Space Grotesk', monospace", color: "var(--text-2)" }}>{v}</span>
                </div>
              ))}
            </div>
            <a
              href={dataset.txHash ? `${GALILEO.explorer}/tx/${dataset.txHash}` : (dataset.publisher ? `${GALILEO.explorer}/address/${dataset.publisher}` : `${GALILEO.explorer}`)}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, color: "var(--primary)", fontSize: 13 }}
            >
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
