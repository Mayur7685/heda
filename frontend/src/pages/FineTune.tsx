import { useEffect, useRef, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { COMPUTE_ROUTER, SUPPORTED_FINETUNE_MODELS } from "../config";

type DatasetOption = { datasetId: number; rootHash: string; label: string };
type JobStatus = "idle" | "submitting" | "pending" | "running" | "succeeded" | "failed";

export default function FineTune() {
  const { signer, address } = useWallet();
  const registry = useDatasetRegistry(signer);

  const [textDatasets, setTextDatasets] = useState<DatasetOption[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedModel, setSelectedModel] = useState(SUPPORTED_FINETUNE_MODELS[0]);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_COMPUTE_API_KEY ?? "");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!registry || !address || loaded.current) return;
    loaded.current = true;
    loadTextDatasets();
  }, [!!registry, address]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadTextDatasets() {
    if (!registry || !address) return;
    const events = await registry.listDatasets();
    const licensed = await Promise.all(
      events
        .filter((d) => d.dataType === 1) // text only
        .map(async (d) => ({
          datasetId: d.datasetId,
          rootHash: d.rootHash,
          label: `Dataset #${d.datasetId} — ${d.rootHash.slice(0, 10)}… (${d.dataType === 1 ? "Text" : "Image"})`,
          hasLicense: await registry.hasLicense(d.datasetId, address),
        }))
    );
    setTextDatasets(licensed.filter((d) => d.hasLicense));
  }

  async function submitJob() {
    if (!selectedDataset || !apiKey) return;
    setError("");
    setStatus("submitting");
    try {
      // Fetch the JSONL dataset from 0G Storage via backend
      const dataset = textDatasets.find((d) => d.rootHash === selectedDataset);
      if (!dataset) throw new Error("Dataset not found");

      // Fetch the JSONL content from 0G Storage
      setStatus("submitting");
      const storageRes = await fetch(`https://indexer-storage-testnet-turbo.0g.ai/file?root=${dataset.rootHash}`);
      if (!storageRes.ok) throw new Error("Failed to fetch dataset from 0G Storage");
      const jsonlContent = await storageRes.text();

      // Validate it's JSONL (at least one valid JSON line)
      const firstLine = jsonlContent.split("\n").find((l) => l.trim());
      if (!firstLine) throw new Error("Dataset is empty");
      try { JSON.parse(firstLine); } catch { throw new Error("Dataset is not valid JSONL format"); }

      // Upload JSONL to 0G Compute as a training file
      const uploadRes = await fetch(`${COMPUTE_ROUTER}/files`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: (() => {
          const fd = new FormData();
          fd.append("file", new Blob([jsonlContent], { type: "application/jsonl" }), "dataset.jsonl");
          fd.append("purpose", "fine-tune");
          return fd;
        })(),
      });

      let trainingFileId: string;
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        trainingFileId = uploadData.id;
      } else {
        // Fallback: pass root hash directly (some providers accept this)
        trainingFileId = dataset.rootHash;
      }

      const res = await fetch(`${COMPUTE_ROUTER}/fine_tuning/jobs`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, training_file: trainingFileId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.id ?? data.jobId ?? "submitted");
      setStatus("pending");
      startPolling(data.id ?? data.jobId);
    } catch (e: any) {
      setError(e.message);
      setStatus("failed");
    }
  }

  function startPolling(id: string) {
    if (!id || id === "submitted") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${COMPUTE_ROUTER}/fine_tuning/jobs/${id}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });
        const data = await res.json();
        const s = data.status as JobStatus;
        setStatus(s);
        if (s === "succeeded" || s === "failed") {
          clearInterval(pollRef.current!);
        }
      } catch {}
    }, 5000);
  }

    
  return (
    <div className="page">
      <h1>Fine-Tune a Model</h1>
      <p className="subtitle">Train a custom LLM on your annotated text dataset using 0G Compute.</p>

      <div className="info-box">
        <strong>Text datasets only.</strong> Vision model fine-tuning is not yet available on 0G Compute.
        Only datasets you own a license for are shown.
      </div>

      {textDatasets.length === 0 && (
        <p className="hint" style={{ marginTop: 16 }}>
          No licensed text datasets found. Purchase a text dataset from the{" "}
          <a href="/datasets">marketplace</a> first.
        </p>
      )}

      {textDatasets.length > 0 && status === "idle" && (
        <div className="form" style={{ marginTop: 24 }}>
          <div className="field">
            <label>Dataset</label>
            <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)}
              style={{ background: "#1a1a1a", color: "#e8e8e8", border: "1px solid #333", borderRadius: 8, padding: "10px 12px" }}>
              <option value="">Select a dataset…</option>
              {textDatasets.map((d) => (
                <option key={d.rootHash} value={d.rootHash}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Base Model</label>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as any)}
              style={{ background: "#1a1a1a", color: "#e8e8e8", border: "1px solid #333", borderRadius: 8, padding: "10px 12px" }}>
              {SUPPORTED_FINETUNE_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>0G Compute API Key</label>
            <input type="password" placeholder="sk-…" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)} />
            <span className="hint">Get from <a href="https://pc.0g.ai" target="_blank" rel="noreferrer">pc.0g.ai</a></span>
          </div>

          {error && <p className="error">{error}</p>}

          <button
            className="btn-primary"
            onClick={submitJob}
            disabled={!selectedDataset || !apiKey}
          >
            Start Fine-Tuning
          </button>
        </div>
      )}

      {status !== "idle" && (
        <div className="status-box" style={{ marginTop: 24 }}>
          <h2>Job Status</h2>
          <div className="flex gap-8" style={{ alignItems: "center", marginTop: 8 }}>
            <span className={`badge ${
              status === "succeeded" ? "badge-approved" :
              status === "failed" ? "badge-closed" : "badge-pending"
            }`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {status === "submitting" ? "upload" :
                 status === "pending" ? "schedule" :
                 status === "running" ? "settings" :
                 status === "succeeded" ? "check_circle" : "cancel"}
              </span>
              {status === "submitting" ? "Submitting…" :
               status === "pending" ? "Pending" :
               status === "running" ? "Running" :
               status === "succeeded" ? "Succeeded" : "Failed"}
            </span>
            {jobId && jobId !== "submitted" && <span className="hint">Job ID: {jobId}</span>}
          </div>
          {status === "succeeded" && (
            <p style={{ marginTop: 12, color: "#00ff88" }}>
              Fine-tuning complete! Download your model weights from the 0G Compute dashboard.
            </p>
          )}
          {status === "failed" && error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
          {(status === "pending" || status === "running") && (
            <p className="hint" style={{ marginTop: 8 }}>Polling every 5s…</p>
          )}
          <button className="btn-secondary" style={{ marginTop: 16 }}
            onClick={() => { setStatus("idle"); setJobId(""); setError(""); }}>
            Start New Job
          </button>
        </div>
      )}
    </div>
  );
}
