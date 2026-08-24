import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { GALILEO } from "../config";

type DatasetRow = { datasetId: number; publisher: string; rootHash: string; price: string; dataType: number; txHash: string; hasLicense?: boolean };
type Filter = "all" | "image" | "text" | "free" | "paid";

export default function Datasets() {
  const { signer, address, isCorrectChain } = useWallet();
  const registry = useDatasetRegistry(signer);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [txMsg, setTxMsg] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    if (!registry || loaded.current) return;
    loaded.current = true;
    loadDatasets();
  }, [!!registry]);

  async function loadDatasets() {
    if (!registry) return;
    setLoading(true);
    try {
      const events = await registry.listDatasets();
      const withLicense = await Promise.all(events.map(async (d) => {
        const base: any = {
          ...d,
          hasLicense: address ? await registry.hasLicense(d.datasetId, address) : false,
          name: undefined,
          format: undefined,
          taskCount: undefined,
        };
        if (d.metadataURI) {
          try {
            const metaRes = await fetch(`https://indexer-storage-testnet-turbo.0g.ai/file?root=${d.metadataURI}`, { signal: AbortSignal.timeout(5000) });
            if (metaRes.ok) {
              const meta = await metaRes.json();
              base.name = meta.name;
              base.format = meta.format;
              base.taskCount = meta.taskCount;
            }
          } catch { /* fallback */ }
        }
        return base;
      }));
      setDatasets(withLicense);
    } finally { setLoading(false); }
  }

  async function purchase(d: DatasetRow) {
    if (!registry) return;
    setTxMsg("Purchasing…");
    try {
      const receipt = await registry.purchase(d.datasetId, d.price);
      setTxMsg(`Purchased ✓ — ${GALILEO.explorer}/tx/${receipt.hash}`);
      setDatasets((prev) => prev.map((x) => x.datasetId === d.datasetId ? { ...x, hasLicense: true } : x));
    } catch (e: any) { setTxMsg(`Error: ${e.message}`); }
  }

  const filtered = datasets.filter((d) => {
    if (filter === "image") return d.dataType === 0;
    if (filter === "text") return d.dataType === 1;
    if (filter === "free") return d.price === "0.0" || d.price === "0";
    if (filter === "paid") return d.price !== "0.0" && d.price !== "0";
    return true;
  });

  if (!signer) return <div className="page" style={{textAlign:"center",paddingTop:80}}><p className="hint">Connect your wallet using the button in the top-right corner.</p></div>;
  if (!isCorrectChain) return <div className="page" style={{textAlign:"center",paddingTop:80}}><p style={{color:"var(--error)",fontSize:13}}>Please switch to Galileo Testnet (Chain ID 16602) in your wallet.</p></div>;

  return (
    <>
      {/* Header */}
      <section style={{ padding: "32px 24px", background: "var(--surface-low)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <span className="label-caps" style={{ color: "var(--primary)", display: "block", marginBottom: 6 }}>Marketplace</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Data Intelligence Datasets</h1>
            <p style={{ color: "var(--text-2)", fontSize: 14, maxWidth: 520 }}>
              Access verified, high-quality decentralized datasets for AI training and machine learning research.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-high)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 16px" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 18 }}>database</span>
            <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 14 }}>{datasets.length} Datasets</span>
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <section style={{ position: "sticky", top: 64, zIndex: 40, background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "10px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="filter-bar">
            {(["all", "image", "text", "free", "paid"] as Filter[]).map((f) => (
              <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="label-caps">Sort:</span>
            <button className="btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Newest <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {txMsg && <div className={`tx-banner ${txMsg.startsWith("Error") ? "error" : ""}`} style={{ marginBottom: 24 }}>
          {txMsg.includes("http") ? <><span>{txMsg.split(" — ")[0]} — </span><a href={txMsg.split(" — ")[1]} target="_blank" rel="noreferrer">View tx ↗</a></> : txMsg}
        </div>}

        {loading && <p className="hint" style={{ textAlign: "center", padding: "48px 0" }}>Loading datasets from chain…</p>}
        {!loading && filtered.length === 0 && <p className="hint" style={{ textAlign: "center", padding: "48px 0" }}>No datasets found.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {filtered.map((d) => {
            const isFree = d.price === "0.0" || d.price === "0";
            return (
              <div key={d.datasetId} className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                {/* Image placeholder */}
                <div style={{ height: 192, background: "var(--surface-high)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 64, color: "var(--border)" }}>
                    {d.dataType === 0 ? "image" : "article"}
                  </span>
                  {d.hasLicense && (
                    <div style={{ position: "absolute", top: 12, left: 12 }}>
                      <span className="badge badge-licensed">Licensed</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column", borderLeft: "2px solid var(--primary)" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                    {(d as any).name || `${d.dataType === 0 ? "Image" : "Text"} Dataset #${d.datasetId}`}
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <span className="label-caps" style={{ display: "block", marginBottom: 2 }}>Type</span>
                      <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 13 }}>{d.dataType === 0 ? "Image" : "Text"}</span>
                    </div>
                    <div>
                      <span className="label-caps" style={{ display: "block", marginBottom: 2 }}>Format</span>
                      <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 13 }}>{(d as any).format || (d.dataType === 0 ? "COCO JSON" : "JSONL")}</span>
                    </div>
                    {(d as any).taskCount && (
                      <div>
                        <span className="label-caps" style={{ display: "block", marginBottom: 2 }}>Tasks</span>
                        <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 13 }}>{(d as any).taskCount}</span>
                      </div>
                    )}
                    <div>
                      <span className="label-caps" style={{ display: "block", marginBottom: 2 }}>Publisher</span>
                      <span className="mono-tag">{d.publisher.slice(0, 6)}…{d.publisher.slice(-4)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 16, borderTop: "1px solid var(--border)", marginTop: "auto" }}>
                    <div>
                      <span className="label-caps" style={{ display: "block", marginBottom: 2 }}>Price</span>
                      <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>
                        {isFree ? "FREE" : `${d.price} 0G`}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link to={`/datasets/${d.datasetId}`} className="btn-secondary btn-sm">Details</Link>
                      {!d.hasLicense && (
                        <button className="btn-primary btn-sm" onClick={() => purchase(d)}>
                          {isFree ? "Get Free" : "Buy Now"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
