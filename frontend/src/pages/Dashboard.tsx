import { useEffect, useRef, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { uploadJson, uploadBlob } from "../hooks/useStorage";
import { GALILEO } from "../config";
import DatasetHealthCard from "../components/DatasetHealthCard";

type JobRow = { jobId: number; dataRootHash: string; rewardPerTask: string; taskCount: number; approvedCount: number; active: boolean; dataType: number };
type SubRow = { taskId: number; annotator: string; annotationRootHash: string; approved: boolean };

export default function Dashboard() {
  const { signer, address } = useWallet();
  const market = useAnnotationMarket(signer);
  const registry = useDatasetRegistry(signer);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState<JobRow | null>(null);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [txMsg, setTxMsg] = useState("");
  const [txErr, setTxErr] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishForm, setPublishForm] = useState({ name: "", description: "", price: "0", labels: "" });
  // Batch select for approve/reject
  const [selectedSubs, setSelectedSubs] = useState<Set<number>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  // Annotated image preview modal
  const [previewSub, setPreviewSub] = useState<SubRow | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewAnnotations, setPreviewAnnotations] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Natural image dimensions so we can compute correct CANVAS_H per image
  const [previewImgSize, setPreviewImgSize] = useState<{ w: number; h: number } | null>(null);
  // annotation cache for health check: maps taskId → annotation data fetched from 0G Storage
  const [annotationCache, setAnnotationCache] = useState<Record<number, any>>({});
  const [healthLabels, setHealthLabels] = useState<string[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (!market || !address || loaded.current) return;
    loaded.current = true;
    loadMyJobs();
  }, [!!market, address]);

  async function loadMyJobs() {
    if (!market || !address) return;
    setLoading(true);
    try {
      const events = await market.listJobs();
      const mine = events.filter((e) => e.creator.toLowerCase() === address.toLowerCase());
      const withState = await Promise.all(mine.map(async (e) => {
        const j = await market.getJob(e.jobId);
        return { jobId: e.jobId, dataRootHash: e.dataRootHash, rewardPerTask: e.rewardPerTask, taskCount: Number(j.taskCount), approvedCount: Number(j.approvedCount), active: j.active, dataType: Number(j.dataType) };
      }));
      setMyJobs(withState);
    } finally { setLoading(false); }
  }

  async function loadSubs(job: JobRow) {
    if (!market) return;
    setSelected(job);
    setSubs([]);
    setAnnotationCache({});
    setHealthLabels([]);
    const rows: SubRow[] = [];
    for (let i = 0; i < job.taskCount; i++) {
      const sub = await market.getSubmission(job.jobId, i);
      if (sub.exists) rows.push({ taskId: i, annotator: sub.annotator, annotationRootHash: sub.annotationRootHash, approved: sub.approved });
    }
    setSubs(rows);

    // Fetch metadata to get labels for health check
    try {
      const metaRes = await fetch(`${GALILEO.storageIndexer}/file?root=${job.dataRootHash}`).catch(() => null);
      const jobMeta: any = metaRes?.ok ? await metaRes.json() : {};
      const labels: string[] = jobMeta.labels ?? [];
      setHealthLabels(labels);

      // Fetch annotation data for approved subs to build health cache
      if (job.dataType === 0 && rows.length > 0) {
        const cache: Record<number, any> = {};
        await Promise.all(rows.map(async (sub) => {
          try {
            const res = await fetch(`${GALILEO.storageIndexer}/file?root=${sub.annotationRootHash}`).catch(() => null);
            if (res?.ok) {
              const data = await res.json();
              cache[sub.taskId] = data?.annotation ?? null;
            }
          } catch { /* skip failed fetches */ }
        }));
        setAnnotationCache(cache);
      }
    } catch { /* ignore */ }
  }

  async function approve(jobId: number, taskId: number) {
    if (!market) return;
    try { await market.approveWork(jobId, taskId); setSubs((s) => s.map((x) => x.taskId === taskId ? { ...x, approved: true } : x)); } catch (e: any) { setTxMsg(e.message); setTxErr(true); }
  }

  async function reject(jobId: number, taskId: number) {
    if (!market) return;
    try { await market.rejectWork(jobId, taskId); setSubs((s) => s.filter((x) => x.taskId !== taskId)); } catch (e: any) { setTxMsg(e.message); setTxErr(true); }
  }

  // ── Batch approve / reject (1 single wallet transaction!) ─────────
  async function batchApprove() {
    if (!market || !selected || selectedSubs.size === 0) return;
    setBatchBusy(true);
    setTxMsg("Approving batch onchain…"); setTxErr(false);
    const taskIds = Array.from(selectedSubs);
    try {
      const receipt = await market.approveBatch(selected.jobId, taskIds);
      setSubs((s) => s.map((x) => selectedSubs.has(x.taskId) ? { ...x, approved: true } : x));
      setTxMsg(`✓ Approved ${taskIds.length} tasks in 1 signature — ${GALILEO.explorer}/tx/${receipt.hash}`);
      setSelectedSubs(new Set());
      await loadMyJobs();
    } catch (e: any) {
      setTxMsg(e.message);
      setTxErr(true);
    } finally {
      setBatchBusy(false);
    }
  }

  async function batchReject() {
    if (!market || !selected || selectedSubs.size === 0) return;
    setBatchBusy(true);
    setTxMsg("Rejecting batch onchain…"); setTxErr(false);
    const taskIds = Array.from(selectedSubs);
    try {
      const receipt = await market.rejectBatch(selected.jobId, taskIds);
      setSubs((s) => s.filter((x) => !selectedSubs.has(x.taskId)));
      setTxMsg(`✓ Rejected ${taskIds.length} tasks in 1 signature — ${GALILEO.explorer}/tx/${receipt.hash}`);
      setSelectedSubs(new Set());
      await loadMyJobs();
    } catch (e: any) {
      setTxMsg(e.message);
      setTxErr(true);
    } finally {
      setBatchBusy(false);
    }
  }

  function toggleSelectSub(taskId: number) {
    setSelectedSubs((prev) => { const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n; });
  }

  function selectAllPending() {
    const pending = subs.filter((s) => !s.approved).map((s) => s.taskId);
    setSelectedSubs((prev) => prev.size === pending.length ? new Set() : new Set(pending));
  }

  // ── Annotated image preview ────────────────────────────────────────
  async function openPreview(sub: SubRow) {
    if (!selected) return;
    setPreviewSub(sub);
    setPreviewLoading(true);
    setPreviewImageUrl("");
    setPreviewAnnotations([]);
    setPreviewImgSize(null);
    try {
      // Fetch annotation JSON (contains bboxes)
      const annRes = await fetch(`${GALILEO.storageIndexer}/file?root=${sub.annotationRootHash}`).catch(() => null);
      const annData = annRes?.ok ? await annRes.json() : null;
      const boxes: any[] = Array.isArray(annData?.annotation) ? annData.annotation : [];
      setPreviewAnnotations(boxes);

      // Fetch raw image data from job's data files
      const dataRes = await fetch(`${GALILEO.storageIndexer}/file?root=${selected.dataRootHash}`).catch(() => null);
      if (dataRes?.ok) {
        const files: Array<{ name: string; type: string; data: string }> = await dataRes.json();
        const file = files[sub.taskId];
        if (file?.data) setPreviewImageUrl(`data:${file.type};base64,${file.data}`);
      }
    } catch { /* show empty */ } finally {
      setPreviewLoading(false);
    }
  }

  async function publishDataset(job: JobRow) {
    if (!registry || !signer) return;
    setTxErr(false);

    try {
      const approvedSubs = subs.filter((s) => s.approved);

      // Fetch job metadata to get jsonlSchema and labels
      setTxMsg("Fetching job metadata…");
      const metaRes = await fetch(`${GALILEO.storageIndexer}/file?root=${job.dataRootHash}`).catch(() => null);
      const jobMeta: any = metaRes?.ok ? await metaRes.json() : {};
      const labels: string[] = publishForm.labels?.split(",").map((l: string) => l.trim()).filter(Boolean) ?? jobMeta.labels ?? [];
      const jsonlSchema: string = jobMeta.jsonlSchema ?? "chat";

      // Fetch all approved annotation data
      setTxMsg("Fetching annotations…");
      const annotationData = await Promise.all(
        approvedSubs.map(async (sub) => {
          const res = await fetch(`${GALILEO.storageIndexer}/file?root=${sub.annotationRootHash}`).catch(() => null);
          return res?.ok ? res.json() : null;
        })
      );

      let datasetRootHash: string;

      if (job.dataType === 1) {
        // ── TEXT → JSONL ──────────────────────────────────────────────
        setTxMsg("Building JSONL dataset…");

        // Fetch original text files
        const dataRes = await fetch(`${GALILEO.storageIndexer}/file?root=${job.dataRootHash}`).catch(() => null);
        const allFiles: Array<{ name: string; data: string }> = dataRes?.ok ? await dataRes.json() : [];

        const lines: string[] = [];
        annotationData.forEach((ann) => {
          if (!ann) return;
          const { taskId, annotation } = ann;
          const file = allFiles[taskId];
          const text = file?.data ? atob(file.data) : `task_${taskId}`;
          const label: string = annotation?.label ?? "";

          if (jsonlSchema === "chat") {
            lines.push(JSON.stringify({
              messages: [
                { role: "user", content: text },
                { role: "assistant", content: label },
              ]
            }));
          } else if (jsonlSchema === "instruction") {
            lines.push(JSON.stringify({ instruction: jobMeta.instructions ?? "Classify the text.", input: text, output: label }));
          } else {
            lines.push(JSON.stringify({ text: `${text}\n${label}` }));
          }
        });

        const jsonlBlob = new Blob([lines.join("\n")], { type: "application/jsonl" });
        datasetRootHash = await uploadBlob(jsonlBlob);

      } else {
        // ── IMAGE → COCO ──────────────────────────────────────────────
        setTxMsg("Building COCO dataset…");
        const dataRes = await fetch(`${GALILEO.storageIndexer}/file?root=${job.dataRootHash}`).catch(() => null);
        const allFiles: Array<{ name: string; type: string; data: string }> = dataRes?.ok ? await dataRes.json() : [];

        const labelToId = Object.fromEntries(labels.map((l, i) => [l, i + 1]));
        const cocoImages: any[] = [];
        const cocoAnnotations: any[] = [];
        let annId = 0;

        annotationData.forEach((ann) => {
          if (!ann) return;
          const { taskId, annotation } = ann;
          const file = allFiles[taskId];
          cocoImages.push({ id: taskId, file_name: file?.name ?? `task_${taskId}.jpg`, width: 640, height: 480, task_id: taskId });
          if (Array.isArray(annotation)) {
            annotation.forEach((bbox: any) => {
              if (bbox.type !== "bbox") return;
              cocoAnnotations.push({ id: annId++, image_id: taskId, category_id: labelToId[bbox.label] ?? 1, bbox: [bbox.x, bbox.y, bbox.w, bbox.h], area: bbox.w * bbox.h, iscrowd: 0 });
            });
          }
        });

        const coco = {
          info: { description: publishForm.name || `Heda Dataset #${job.jobId}`, date_created: new Date().toISOString(), source_job_id: job.jobId },
          images: cocoImages,
          annotations: cocoAnnotations,
          categories: labels.map((name, i) => ({ id: i + 1, name, supercategory: "object" })),
        };
        datasetRootHash = await uploadJson(coco);
      }

      // Upload metadata
      const metaHash = await uploadJson({
        name: publishForm.name || `Dataset #${job.jobId}`,
        description: publishForm.description,
        dataType: job.dataType === 0 ? "image" : "text",
        format: job.dataType === 1 ? `JSONL (${jsonlSchema})` : "COCO JSON",
        jsonlSchema: job.dataType === 1 ? jsonlSchema : undefined,
        sourceJobId: job.jobId,
        labels,
        taskCount: job.taskCount,
        approvedCount: job.approvedCount,
      });

      setTxMsg("Publishing onchain…");
      const r = await registry.publish(datasetRootHash, metaHash, publishForm.price, job.dataType as 0 | 1, job.jobId);
      setTxMsg(`Published ✓ — ${GALILEO.explorer}/tx/${r.hash}`);
      setPublishing(false);
    } catch (e: any) { setTxMsg(e.message); setTxErr(true); }
  }

    
  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
      {/* Left panel */}
      <aside style={{ width: 280, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "sticky", top: 64, height: "calc(100vh - 64px)", overflowY: "auto" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="label-caps">Active Jobs</span>
        </div>
        <div style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {loading && <p className="hint" style={{ padding: 8 }}>Loading…</p>}
          {!loading && myJobs.length === 0 && <p className="hint" style={{ padding: 8 }}>No jobs yet. <a href="/create">Create one →</a></p>}
          {myJobs.map((job) => (
            <div key={job.jobId} onClick={() => loadSubs(job)}
              style={{
                padding: 16, borderRadius: 4, cursor: "pointer",
                background: selected?.jobId === job.jobId ? "var(--surface-high)" : "var(--surface-low)",
                border: selected?.jobId === job.jobId ? "2px solid var(--primary)" : "1px solid var(--border)",
                transition: "all 0.15s",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: selected?.jobId === job.jobId ? "var(--primary)" : "var(--text-2)" }}>
                  JOB #{job.jobId}
                </span>
                <span className={`badge ${job.active ? "badge-open" : "badge-closed"}`} style={{ fontSize: 10 }}>
                  {job.active ? "OPEN" : "CLOSED"}
                </span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>{job.dataType === 0 ? "image" : "article"}</span>
                Job #{job.jobId}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="progress-bar" style={{ flex: 1 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(100, (job.approvedCount / job.taskCount) * 100)}%` }} />
                </div>
                <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, color: "var(--text-2)" }}>
                  {job.approvedCount}/{job.taskCount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right panel */}
      <section style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {!selected && (
          <div style={{ textAlign: "center", paddingTop: 80, color: "var(--text-3)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 12 }}>layers</span>
            <p>Select a job from the left panel to review submissions.</p>
          </div>
        )}

        {selected && (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 18 }}>layers</span>
                  <span className="label-caps">Current Workspace</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                  {selected.dataType === 0 ? "Image" : "Text"} Annotation Job #{selected.jobId}
                </h2>
                <div style={{ display: "flex", gap: 24 }}>
                  {[
                    ["Approved Tasks", `${selected.approvedCount} / ${selected.taskCount}`, "var(--primary)"],
                    ["Pending Review", `${subs.filter((s) => !s.approved).length}`, "var(--text)"],
                    ["Reward/Task", `${selected.rewardPerTask} 0G`, "var(--text)"],
                  ].map(([label, value, color]) => (
                    <div key={label}>
                      <span className="label-caps" style={{ display: "block", marginBottom: 2 }}>{label}</span>
                      <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 14, color: color as string }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selected.approvedCount === selected.taskCount && selected.taskCount > 0 && (
                <button className="btn-primary" onClick={() => setPublishing(true)}
                  disabled={publishing || txMsg.startsWith("Building") || txMsg.startsWith("Fetching") || txMsg.startsWith("Uploading") || txMsg.startsWith("Publishing")}>
                  {txMsg && !txErr && txMsg !== "" && !txMsg.includes("✓") ? txMsg : "Publish Dataset"}
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </button>
              )}
            </div>

            {txMsg && (
              <div className={`tx-banner ${txErr ? "error" : ""}`} style={{ marginBottom: 16 }}>
                {txMsg.includes("http") ? <><span>{txMsg.split(" — ")[0]} — </span><a href={txMsg.split(" — ")[1]} target="_blank" rel="noreferrer">View tx ↗</a></> : txMsg}
              </div>
            )}

            {/* Submissions table */}
            <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
              {/* Batch action bar */}
              {selectedSubs.size > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                  background: "rgba(0,228,121,0.06)", borderBottom: "1px solid rgba(0,228,121,0.2)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
                    {selectedSubs.size} selected
                  </span>
                  <button className="btn-primary btn-sm" onClick={batchApprove} disabled={batchBusy}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
                    {batchBusy ? "Approving…" : `Approve ${selectedSubs.size}`}
                  </button>
                  <button className="btn-sm" onClick={batchReject} disabled={batchBusy}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 4, border: "1px solid var(--error)", background: "rgba(255,68,68,0.08)", color: "var(--error)", fontSize: 12, fontWeight: 600, cursor: batchBusy ? "not-allowed" : "pointer" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>cancel</span>
                    {batchBusy ? "Rejecting…" : `Reject ${selectedSubs.size}`}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setSelectedSubs(new Set())} style={{ marginLeft: "auto" }}>Clear</button>
                </div>
              )}
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, paddingRight: 0 }}>
                      {/* Select All pending */}
                      <input type="checkbox"
                        checked={selectedSubs.size > 0 && selectedSubs.size === subs.filter((s) => !s.approved).length}
                        onChange={selectAllPending}
                        style={{ cursor: "pointer", accentColor: "var(--primary)" }} />
                    </th>
                    <th>Task #</th>
                    <th>Annotator</th>
                    <th>Preview</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No submissions yet.</td></tr>
                  )}
                  {subs.map((sub) => (
                    <tr key={sub.taskId} style={{ background: selectedSubs.has(sub.taskId) ? "rgba(0,228,121,0.04)" : "transparent" }}>
                      <td style={{ paddingRight: 0 }}>
                        {!sub.approved && (
                          <input type="checkbox"
                            checked={selectedSubs.has(sub.taskId)}
                            onChange={() => toggleSelectSub(sub.taskId)}
                            style={{ cursor: "pointer", accentColor: "var(--primary)" }} />
                        )}
                      </td>
                      <td style={{ fontFamily: "'Space Grotesk', monospace" }}>#{sub.taskId + 1}</td>
                      <td><span className="mono-tag">{sub.annotator.slice(0, 6)}…{sub.annotator.slice(-4)}</span></td>
                      <td>
                        {/* Preview annotated image — replaces raw hash link */}
                        <button
                          onClick={() => openPreview(sub)}
                          style={{ display: "flex", alignItems: "center", gap: 5,
                            background: "var(--surface-high)", border: "1px solid var(--border)",
                            borderRadius: 4, padding: "4px 10px", cursor: "pointer",
                            fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>visibility</span>
                          View
                        </button>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {sub.approved ? (
                          <span className="badge badge-approved">Approved</span>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <button className="btn-ghost btn-icon" onClick={() => approve(selected!.jobId, sub.taskId)} title="Approve this task">
                              <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 20 }}>check_circle</span>
                            </button>
                            <button className="btn-ghost btn-icon" onClick={() => reject(selected!.jobId, sub.taskId)} title="Reject this task">
                              <span className="material-symbols-outlined" style={{ color: "var(--error)", fontSize: 20 }}>cancel</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Annotated Image Preview Modal */}
            {previewSub && (
              <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
                onClick={() => setPreviewSub(null)}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: 24, maxWidth: 700, width: "90vw", maxHeight: "90vh", overflow: "auto" }}
                  onClick={(e) => e.stopPropagation()}>
                  {/* Modal header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>Task #{previewSub.taskId + 1} — Annotated Preview</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        by <span className="mono-tag">{previewSub.annotator.slice(0, 8)}…{previewSub.annotator.slice(-6)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!previewSub.approved && (
                        <><button className="btn-primary btn-sm" onClick={() => { approve(selected!.jobId, previewSub.taskId); setPreviewSub(null); }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span> Approve
                        </button>
                        <button className="btn-sm" onClick={() => { reject(selected!.jobId, previewSub.taskId); setPreviewSub(null); }}
                          style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid var(--error)", background: "rgba(255,68,68,0.08)", color: "var(--error)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span> Reject
                        </button></>
                      )}
                      <button className="btn-ghost btn-icon" onClick={() => setPreviewSub(null)}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Image + overlaid bboxes */}
                  {previewLoading && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-3)", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>progress_activity</span>
                      Loading from 0G Storage…
                    </div>
                  )}
                  {!previewLoading && previewImageUrl && (
                    <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                      <img
                        src={previewImageUrl}
                        alt="annotated"
                        style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }}
                        // Capture natural size on load so bbox coords map correctly
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setPreviewImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                        }}
                      />
                      {/* Render bbox overlays — coordinates are in Workspace canvas space:
                          x, w → 0..CANVAS_W (640px)
                          y, h → 0..CANVAS_H (= naturalH/naturalW × 640)
                          We convert to % of the rendered image size. */}
                      {previewImgSize && previewAnnotations.filter((a) => a.type === "bbox").map((box: any, i: number) => {
                        const palette = ["#00e479","#ff6b6b","#ffd700","#00bfff","#ff69b4","#7fff00"];
                        const col = palette[i % palette.length];
                        const CANVAS_W = 640;
                        // Match exactly how ImageWorkspace computes canvas height:
                        const CANVAS_H = Math.round((previewImgSize.h / previewImgSize.w) * CANVAS_W);
                        return (
                          <div key={box.id ?? i} style={{
                            position: "absolute",
                            left:   `${(box.x / CANVAS_W) * 100}%`,
                            top:    `${(box.y / CANVAS_H) * 100}%`,
                            width:  `${(box.w / CANVAS_W) * 100}%`,
                            height: `${(box.h / CANVAS_H) * 100}%`,
                            border: `2px solid ${col}`,
                            pointerEvents: "none",
                          }}>
                            <span style={{
                              position: "absolute", top: -18, left: 0,
                              background: col, color: "#000", fontSize: 10, fontWeight: 700,
                              padding: "1px 5px", borderRadius: 2, whiteSpace: "nowrap",
                            }}>{box.label}</span>
                          </div>
                        );
                      })}
                      {/* Show skeleton boxes until image natural size is known */}
                      {!previewImgSize && previewAnnotations.length > 0 && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Loading overlays…</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!previewLoading && !previewImageUrl && (
                    <div style={{ color: "var(--text-3)", textAlign: "center", padding: 32, fontSize: 13 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 32, display: "block", marginBottom: 8 }}>image_not_supported</span>
                      Image unavailable from 0G Storage
                    </div>
                  )}

                  {/* Annotation summary */}
                  {previewAnnotations.length > 0 && (
                    <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {previewAnnotations.map((a: any, i: number) => (
                        <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--surface-high)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                          {a.label} · {Math.round(a.w)}×{Math.round(a.h)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Publish form */}
            {publishing && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Publish as Dataset</h3>

                {/* Dataset Health Check — shown above publish form */}
                {selected.dataType === 0 && healthLabels.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <DatasetHealthCard
                      annotations={annotationCache}
                      totalTasks={selected.taskCount}
                      labels={healthLabels}
                    />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Name</label>
                    <input type="text" placeholder={`Dataset from Job #${selected.jobId}`} value={publishForm.name} onChange={(e) => setPublishForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Labels (comma-separated)</label>
                    <input type="text" placeholder="car, person, building" value={publishForm.labels}
                      onChange={(e) => setPublishForm((f) => ({ ...f, labels: e.target.value }))} />
                    <p className="hint" style={{ marginTop: 4 }}>Used to build COCO categories</p>
                  </div>
                  <div>
                    <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Price (0G) — 0 for free</label>
                    <input type="number" step="0.01" min="0" value={publishForm.price} onChange={(e) => setPublishForm((f) => ({ ...f, price: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={() => publishDataset(selected)}>Publish</button>
                    <button className="btn-secondary" onClick={() => setPublishing(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
