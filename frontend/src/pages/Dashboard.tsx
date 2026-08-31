import { useEffect, useRef, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarketV2 } from "../hooks/useAnnotationMarketV2";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { uploadJson, uploadBlob, fetchFrom0GStorage } from "../hooks/useStorage";
import { GALILEO, RELAYER_API_URL } from "../config";
import DatasetHealthCard from "../components/DatasetHealthCard";
import DatasetCreationModal from "../components/DatasetCreationModal";


type JobRow = { jobId: number; dataRootHash: string; rewardPerTask: string; taskCount: number; approvedCount: number; active: boolean; dataType: number };
type SubRow = { taskId: number; annotator: string; annotationRootHash: string; approved: boolean };

export default function Dashboard() {
  const { signer, address } = useWallet();
  const marketV2  = useAnnotationMarketV2(signer);
  const registry  = useDatasetRegistry(signer);
  const [myJobs, setMyJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState<JobRow | null>(null);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [txMsg, setTxMsg] = useState("");
  const [txErr, setTxErr] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishForm, setPublishForm] = useState({ name: "", description: "", price: "0", labels: "" });
  // Batch select for approve/reject (keyed by "taskId:annotator")
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
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
  const [publishedJobIds, setPublishedJobIds] = useState<Set<number>>(new Set());
  const [pubBusy, setPubBusy] = useState(false);
  // V2: per-task annotation quality from indexer REST API
  const [v2TaskData, setV2TaskData] = useState<Record<number, { submissions: any[]; submissionCount: number }>>({});
  const [evalBusy, setEvalBusy] = useState<number | null>(null); // taskId being evaluated
  const loaded = useRef(false);

  useEffect(() => {
    if (!marketV2 || !address || loaded.current) return;
    loaded.current = true;
    loadMyJobs();
  }, [!!marketV2, address]);

  async function loadMyJobs() {
    if (!address) return;
    setLoading(true);
    try {
      // Only load V2 jobs — V1 is legacy and causes duplicate JOB #0 since both start at id=0
      const v2Events = marketV2 ? await marketV2.listJobs().catch(() => []) : [];
      const mineV2 = v2Events.filter((e: any) => e.creator.toLowerCase() === address.toLowerCase());

      const withStateV2 = marketV2
        ? await Promise.all(
            mineV2.map(async (e: any) => {
              try {
                const j = await marketV2.getJob(e.jobId);
                return {
                  jobId: e.jobId,
                  dataRootHash: e.dataRootHash,
                  rewardPerTask: e.rewardPerTask,
                  taskCount: Number(j.taskCount),
                  approvedCount: Number(j.approvedTaskCount ?? 0),
                  active: j.active,
                  dataType: Number(j.dataType),
                  isV2: true,
                };
              } catch {
                return null;
              }
            })
          )
        : [];

      const allMine = withStateV2.filter(Boolean) as JobRow[];
      setMyJobs(allMine);

      if (registry) {
        try {
          const list = await registry.listDatasets();
          const pubSet = new Set(list.map((d: any) => Number(d.sourceJobId)));
          setPublishedJobIds(pubSet);
        } catch {}
      }
    } finally {
      setLoading(false);

    }
  }

  async function loadSubs(job: JobRow) {
    setSelected(job);
    setSubs([]);
    setAnnotationCache({});
    setHealthLabels([]);
    const rows: SubRow[] = [];

    if ((job as any).isV2 || marketV2) {
      // For V2 jobs, fetch task annotations from BOTH V2 onchain contract & indexer REST API
      const taskDataMap: Record<number, any> = {};
      for (let i = 0; i < job.taskCount; i++) {
        try {
          const [onchainSubs, indexerRes] = await Promise.all([
            marketV2 ? marketV2.getTaskSubmissions(job.jobId, i).catch(() => []) : [],
            fetch(`${RELAYER_API_URL}/annotations/task/${job.jobId}/${i}`).then((r) => r.ok ? r.json() : null).catch(() => null),
          ]);

          if (indexerRes) {
            taskDataMap[i] = indexerRes;
          }

          const seenAnnotators = new Set<string>();

          // Add submissions returned by indexer
          if (indexerRes && Array.isArray(indexerRes.submissions)) {
            for (const sub of indexerRes.submissions) {
              const addrLower = (sub.annotator || "").toLowerCase();
              if (addrLower) seenAnnotators.add(addrLower);
              rows.push({
                taskId: i,
                annotator: sub.annotator,
                annotationRootHash: sub.annotation_root_hash || sub.annotationRootHash || "",
                approved: sub.status === "rewarded",
              });
            }
          }

          // Merge any on-chain submissions that indexer hasn't synced yet
          if (Array.isArray(onchainSubs)) {
            for (const oSub of onchainSubs) {
              const addrLower = (oSub.annotator || "").toLowerCase();
              if (addrLower && !seenAnnotators.has(addrLower)) {
                seenAnnotators.add(addrLower);
                rows.push({
                  taskId: i,
                  annotator: oSub.annotator,
                  annotationRootHash: oSub.annotationRootHash || "",
                  approved: Boolean(oSub.rewarded),
                });
              }
            }
          }
        } catch (e) {
          console.warn(`Error loading task ${i} submissions:`, e);
        }
      }
      setV2TaskData(taskDataMap);
    }

    setSubs(rows);

    // Fetch metadata to get labels for health check
    try {
      const jobMeta: any = await fetchFrom0GStorage(job.dataRootHash, 3).catch(() => ({}));
      const labels: string[] = jobMeta?.labels ?? [];
      setHealthLabels(labels);

      // Fetch annotation data for approved subs to build health cache
      if (job.dataType === 0 && rows.length > 0) {
        const cache: Record<number, any> = {};
        await Promise.all(rows.map(async (sub) => {
          try {
            const data = await fetchFrom0GStorage(sub.annotationRootHash, 3).catch(() => null);
            if (data) cache[sub.taskId] = data?.annotation ?? null;
          } catch { /* skip failed fetches */ }
        }));
        setAnnotationCache(cache);
      }
    } catch { /* ignore */ }
  }

  function toggleSelectSub(key: string) {
    setSelectedSubs((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function selectAllPending() {
    const pending = subs.filter((s) => !s.approved).map((s) => `${s.taskId}:${s.annotator.toLowerCase()}`);
    setSelectedSubs((prev) => prev.size === pending.length ? new Set() : new Set(pending));
  }

  async function batchEvaluate() {
    if (!marketV2 || !selected || selectedSubs.size === 0) return;
    setBatchBusy(true);
    setTxMsg("Triggering evaluation for selected tasks…"); setTxErr(false);
    const taskIds = Array.from(new Set(Array.from(selectedSubs).map(k => Number(k.split(":")[0]))));
    try {
      for (const tid of taskIds) {
        fetch(`${RELAYER_API_URL}/annotations/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: selected.jobId, taskId: tid }),
        }).catch(() => {});
      }
      setTxMsg(`⚡ Triggered Moondream evaluation for ${taskIds.length} tasks.`);
      setSelectedSubs(new Set());
    } catch (e: any) {
      setTxMsg(e.message);
      setTxErr(true);
    } finally {
      setBatchBusy(false);
    }
  }

  // ── Close / Archive Job (refunds unspent bounty) ───────────────────
  async function handleCloseJob(jobId: number) {
    if (!marketV2) return;
    if (!window.confirm(`Are you sure you want to archive Job #${jobId}? All unspent bounty ETH will be refunded to your wallet.`)) return;
    setTxMsg("Closing job & refunding unspent bounty onchain…");
    setTxErr(false);
    try {
      const receipt = await marketV2.closeJob(jobId);
      setTxMsg(`✓ Job #${jobId} archived & unspent bounty refunded — ${GALILEO.explorer}/tx/${receipt.hash}`);
      await loadMyJobs();
      if (selected?.jobId === jobId) {
        setSelected((prev) => prev ? { ...prev, active: false } : null);
      }
    } catch (e: any) {
      setTxMsg(`Archive failed: ${e.message}`);
      setTxErr(true);
    }
  }

  // ── Multi-Layer Annotated image preview + Moondream GT Inspection ──────
  const [previewGTBoxes, setPreviewGTBoxes] = useState<any[]>([]);
  const [previewTaskSubmissions, setPreviewTaskSubmissions] = useState<any[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({ gt: true, anno: true });
  const [customSharesBps, setCustomSharesBps] = useState<Record<string, number>>({});
  const [overrideBusy, setOverrideBusy] = useState(false);

  async function openPreview(sub: SubRow) {
    if (!selected) return;
    setPreviewSub(sub);
    setPreviewLoading(true);
    setPreviewImageUrl("");
    setPreviewAnnotations([]);
    setPreviewGTBoxes([]);
    setPreviewTaskSubmissions([]);
    setPreviewImgSize(null);
    setCustomSharesBps({});
    setLayerVisibility({ gt: true, anno: true });

    try {
      // Fetch annotation JSON, dataset files, indexer GT & all submissions in parallel
      const [annData, files, gtRes, taskAnnoRes] = await Promise.all([
        fetchFrom0GStorage(sub.annotationRootHash, 5).catch(() => null),
        fetchFrom0GStorage(selected.dataRootHash, 5).catch(() => null),
        fetch(`${RELAYER_API_URL}/annotations/ground-truth/${selected.jobId}/${sub.taskId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${RELAYER_API_URL}/annotations/task/${selected.jobId}/${sub.taskId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      const boxes: any[] = Array.isArray(annData?.annotation) ? annData.annotation : [];
      setPreviewAnnotations(boxes);

      if (gtRes?.groundTruth && Array.isArray(gtRes.groundTruth)) {
        setPreviewGTBoxes(gtRes.groundTruth);
      }

      if (taskAnnoRes?.submissions && Array.isArray(taskAnnoRes.submissions)) {
        setPreviewTaskSubmissions(taskAnnoRes.submissions);
        const initShares: Record<string, number> = {};
        taskAnnoRes.submissions.forEach((s: any) => {
          initShares[s.annotator.toLowerCase()] = s.reward_share_bps || 0;
        });
        setCustomSharesBps(initShares);
      }

      if (Array.isArray(files)) {
        const file = files[sub.taskId];
        if (file?.data) setPreviewImageUrl(`data:${file.type};base64,${file.data}`);
      }
    } catch { /* show empty */ } finally {
      setPreviewLoading(false);
    }
  }

  async function openPublishModal(job: JobRow) {
    setPublishing(true);
    try {
      const jobMeta: any = await fetchFrom0GStorage(job.dataRootHash, 3).catch(() => ({}));
      const existingLabels = Array.isArray(jobMeta.labels) ? jobMeta.labels.join(", ") : jobMeta.labels || "";
      setPublishForm({
        name: `Dataset from Job #${job.jobId}`,
        labels: existingLabels || "",
        price: "0",
        description: jobMeta.instructions || `Annotated dataset from Job #${job.jobId}`,
      });
    } catch (e) {
      console.warn("Could not prefill publish form:", e);
    }
  }

  async function publishDataset(job: JobRow) {
    if (!registry || !signer) return;
    setTxErr(false);
    setPubBusy(true);

    try {
      const approvedSubs = subs.filter((s) => s.approved);

      // Fetch job metadata to get jsonlSchema and labels
      setTxMsg("Fetching job metadata…");
      const jobMeta: any = await fetchFrom0GStorage(job.dataRootHash, 3).catch(() => ({}));
      const labels: string[] = publishForm.labels?.split(",").map((l: string) => l.trim()).filter(Boolean) ?? jobMeta.labels ?? [];
      const jsonlSchema: string = jobMeta.jsonlSchema ?? "chat";

      // Fetch all approved annotation data
      setTxMsg("Fetching annotations…");
      const annotationData = await Promise.all(
        approvedSubs.map(async (sub) => {
          return fetchFrom0GStorage(sub.annotationRootHash, 3).catch(() => null);
        })
      );

      let datasetRootHash: string;
      let previewImage: string | undefined = undefined;

      if (job.dataType === 1) {
        // ── TEXT → JSONL ──────────────────────────────────────────────
        setTxMsg("Building JSONL dataset…");

        // Fetch original text files
        const allFiles: Array<{ name: string; data: string }> = await fetchFrom0GStorage(job.dataRootHash, 3).catch(() => []);

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
        const rawFiles: any = await fetchFrom0GStorage(job.dataRootHash, 3).catch(() => []);
        const allFiles: any[] = Array.isArray(rawFiles)
          ? rawFiles
          : rawFiles && typeof rawFiles === "object"
          ? Object.values(rawFiles)
          : [];

        const labelToId = Object.fromEntries(labels.map((l, i) => [l, i + 1]));
        const cocoImages: any[] = [];
        const cocoAnnotations: any[] = [];
        let annId = 0;

        annotationData.forEach((ann) => {
          if (!ann) return;
          const { taskId, annotation } = ann;
          const file = allFiles.find((f: any) => f.taskId === taskId) || allFiles[taskId];
          cocoImages.push({
            id: taskId,
            file_name: file?.name ?? `task_${taskId}.jpg`,
            width: 640,
            height: 480,
            task_id: taskId,
            base64: file?.data ? (file.data.startsWith("data:") ? file.data : `data:${file?.type || "image/jpeg"};base64,${file.data}`) : undefined,
          });
          if (Array.isArray(annotation)) {
            annotation.forEach((bbox: any) => {
              if (bbox.type !== "bbox") return;
              cocoAnnotations.push({ id: annId++, image_id: taskId, category_id: labelToId[bbox.label] ?? 1, bbox: [bbox.x, bbox.y, bbox.w, bbox.h], area: bbox.w * bbox.h, iscrowd: 0 });
            });
          }
        });

        const coco = {
          info: {
            description: publishForm.name || `Heda Dataset #${job.jobId}`,
            date_created: new Date().toISOString(),
            source_job_id: job.jobId,
            data_root_hash: job.dataRootHash,
          },
          images: cocoImages,
          annotations: cocoAnnotations,
          categories: labels.map((name, i) => ({ id: i + 1, name, supercategory: "object" })),
        };
        const sampleFile = Array.isArray(allFiles) ? allFiles[0] : null;
        if (sampleFile?.data) {
          previewImage = sampleFile.data.startsWith("data:") ? sampleFile.data : `data:${sampleFile.type || "image/jpeg"};base64,${sampleFile.data}`;
        }
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
        previewImage,
      });

      setTxMsg("Publishing onchain…");
      const r = await registry.publish(datasetRootHash, metaHash, publishForm.price, job.dataType as 0 | 1, job.jobId);
      setTxMsg(`Published ✓ — ${GALILEO.explorer}/tx/${r.hash}`);
      setPublishedJobIds((prev) => new Set([...prev, job.jobId]));
      setPublishing(false);
    } catch (e: any) { setTxMsg(e.message); setTxErr(true); } finally { setPubBusy(false); }
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
              <div style={{ display: "flex", gap: 10 }}>
                {selected.active && (
                  <>
                    {/* V2: Evaluate All Pending — triggers Moondream IoU for all tasks */}
                    {marketV2 && subs.some((s) => !s.approved) && (
                      <button
                        onClick={async () => {
                          if (!selected) return;
                          setEvalBusy(-1);
                          setTxMsg("Triggering evaluation for all pending tasks…");
                          setTxErr(false);
                          try {
                            // Call triggerEvaluation for each unapproved task on-chain (one tx each)
                            const pending = subs.filter((s) => !s.approved);
                            for (const sub of pending) {
                              try {
                                await marketV2!.triggerEvaluation(selected.jobId, sub.taskId);
                              } catch { /* may already be evaluated */ }
                            }
                            setTxMsg(`✓ Evaluation triggered for ${pending.length} tasks — Moondream will score and auto-distribute rewards.`);
                          } catch (e: any) {
                            setTxMsg(e.message);
                            setTxErr(true);
                          } finally {
                            setEvalBusy(null);
                          }
                        }}
                        disabled={evalBusy !== null}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 14px", border: "1px solid rgba(0,228,121,0.4)",
                          background: "rgba(0,228,121,0.08)", color: "var(--primary)",
                          borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: evalBusy !== null ? "not-allowed" : "pointer",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
                        {evalBusy === -1 ? "Evaluating…" : "Evaluate All (Moondream)"}
                      </button>
                    )}
                    <button
                      className="btn-ghost"
                      onClick={() => handleCloseJob(selected.jobId)}
                      title="Archive this job and refund unspent bounty 0G"
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", border: "1px solid var(--border)",
                        color: "var(--text-2)", borderRadius: 6, fontSize: 13, fontWeight: 600,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--warn)" }}>archive</span>
                      Archive &amp; Refund Job
                    </button>
                  </>
                )}
                {publishedJobIds.has(selected.jobId) ? (
                  <a href="/datasets" className="badge badge-approved" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                    Dataset Published ✓
                  </a>
                ) : (
                  selected.approvedCount === selected.taskCount && selected.taskCount > 0 && (
                    <button className="btn-primary" onClick={() => openPublishModal(selected)}
                      disabled={publishing || pubBusy || txMsg.startsWith("Building") || txMsg.startsWith("Fetching") || txMsg.startsWith("Uploading") || txMsg.startsWith("Publishing")}>
                      {pubBusy ? "Publishing onchain…" : "Publish Dataset"}
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                    </button>
                  )
                )}
              </div>
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
                  <button className="btn-primary btn-sm" onClick={batchEvaluate} disabled={batchBusy}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
                    {batchBusy ? "Triggering…" : `Evaluate ${selectedSubs.size} Tasks`}
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
                    <th>Transaction</th>
                    {/* V2: IoU quality score column */}
                    <th style={{ textAlign: "center" }}>
                      <span title="Moondream IoU quality score (auto-evaluated)" style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "help" }}>
                        IoU Score
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--text-3)" }}>help_outline</span>
                      </span>
                    </th>
                    <th>Preview</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No submissions yet.</td></tr>
                  )}
                  {subs.map((sub, idx) => {
                    // Try to find V2 quality data from indexer for this annotator+task
                    const subKey = `${sub.taskId}:${sub.annotator.toLowerCase()}`;
                    const taskAnno = v2TaskData[sub.taskId];
                    const v2Sub = taskAnno?.submissions?.find((s: any) =>
                      s.annotator?.toLowerCase() === sub.annotator?.toLowerCase()
                    );
                    const iouScore: number | null = v2Sub?.iou_score ?? null;
                    const rewardBps: number = v2Sub?.reward_share_bps ?? 0;
                    const subStatus: string = v2Sub?.status ?? "";
                    const txHash: string = v2Sub?.tx_hash || "";

                    return (
                    <tr key={`${sub.taskId}-${sub.annotator}-${idx}`} style={{ background: selectedSubs.has(subKey) ? "rgba(0,228,121,0.04)" : "transparent" }}>
                      <td style={{ paddingRight: 0 }}>
                        {!sub.approved && (
                          <input type="checkbox"
                            checked={selectedSubs.has(subKey)}
                            onChange={() => toggleSelectSub(subKey)}
                            style={{ cursor: "pointer", accentColor: "var(--primary)" }} />
                        )}
                      </td>
                      <td style={{ fontFamily: "'Space Grotesk', monospace" }}>#{sub.taskId + 1}</td>
                      <td><span className="mono-tag">{sub.annotator.slice(0, 6)}…{sub.annotator.slice(-4)}</span></td>
                      <td>
                        {txHash ? (
                          <a
                            href={`${GALILEO.explorer}/tx/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mono-tag"
                            style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
                            title={`View on 0G Chain Explorer: ${txHash}`}
                          >
                            {txHash.slice(0, 6)}…{txHash.slice(-4)}
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
                          </a>
                        ) : sub.annotationRootHash ? (
                          <span className="mono-tag" title={`Root: ${sub.annotationRootHash}`} style={{ color: "var(--text-3)" }}>
                            {sub.annotationRootHash.slice(0, 6)}…{sub.annotationRootHash.slice(-4)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                        )}
                      </td>

                      {/* V2 IoU Score cell */}
                      <td style={{ textAlign: "center" }}>
                        {iouScore !== null ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{
                              fontFamily: "'Space Grotesk', monospace", fontSize: 13, fontWeight: 700,
                              color: iouScore >= 0.7 ? "var(--primary)" : iouScore >= 0.3 ? "#ffd700" : "var(--error)",
                            }}>{(iouScore * 100).toFixed(1)}%</span>
                            {rewardBps > 0 && (
                              <span style={{ fontSize: 10, color: "var(--text-3)" }}>({(rewardBps / 100).toFixed(1)}%)</span>
                            )}
                            {subStatus === "rewarded" && (
                              <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--primary)" }}>paid</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                        )}
                      </td>

                      <td>
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
                        {v2Sub?.status === "rewarded" || subStatus === "rewarded" ? (
                          <span className="badge badge-approved" title={`Rewarded ${v2Sub?.reward_share_bps ? (v2Sub.reward_share_bps / 100) : 100}% share`}>
                            Auto-Rewarded ({v2Sub?.reward_share_bps ? `${(v2Sub.reward_share_bps / 100).toFixed(0)}%` : "100%"})
                          </span>
                        ) : v2Sub?.status === "evaluating" || evalBusy === sub.taskId ? (
                          <span className="badge" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13, animation: "spin 1.5s linear infinite" }}>progress_activity</span>
                            Evaluating Moondream…
                          </span>
                        ) : v2Sub?.status === "evaluated" ? (
                          <span className="badge" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}>
                            Evaluated ({v2Sub?.reward_share_bps ? `${(v2Sub.reward_share_bps / 100).toFixed(0)}%` : "Pending Tx"})
                          </span>
                        ) : v2Sub?.status === "rejected" ? (
                          <span className="badge" style={{ background: "rgba(255,68,68,0.12)", color: "var(--error)", border: "1px solid rgba(255,68,68,0.3)" }}>
                            Low IoU ({((v2Sub.iou_score || 0) * 100).toFixed(0)}%)
                          </span>
                        ) : sub.approved ? (
                          <span className="badge badge-approved">Approved</span>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            {/* V2: Per-task manual evaluate trigger */}
                            {marketV2 ? (
                              <button
                                onClick={async () => {
                                  setEvalBusy(sub.taskId);
                                  setV2TaskData((prev) => ({
                                    ...prev,
                                    [sub.taskId]: {
                                      ...prev[sub.taskId],
                                      submissions: prev[sub.taskId]?.submissions?.map((s: any) =>
                                        s.annotator.toLowerCase() === sub.annotator.toLowerCase() ? { ...s, status: "evaluating" } : s
                                      ) || [{ annotator: sub.annotator, status: "evaluating" }]
                                    }
                                  }));
                                  try {
                                    // Trigger backend indexer evaluation immediately via HTTP REST API
                                    fetch(`${RELAYER_API_URL}/annotations/evaluate`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ jobId: selected!.jobId, taskId: sub.taskId }),
                                    }).catch(() => {});

                                    // Also emit onchain event as backup
                                    await marketV2!.triggerEvaluation(selected!.jobId, sub.taskId);
                                    setTxMsg(`⚡ Evaluation triggered for Task #${sub.taskId + 1} — Moondream is scoring now.`);
                                    setTxErr(false);
                                  } catch (e: any) {
                                    setTxMsg(e.message); setTxErr(true);
                                  } finally { setEvalBusy(null); }
                                }}
                                disabled={evalBusy === sub.taskId || evalBusy === -1}
                                title="Trigger Moondream IoU quality evaluation for this task"
                                style={{
                                  padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(0,228,121,0.3)",
                                  background: "rgba(0,228,121,0.07)", color: "var(--primary)",
                                  fontSize: 11, fontWeight: 600, cursor: evalBusy !== null ? "not-allowed" : "pointer",
                                  display: "flex", alignItems: "center", gap: 3,
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bolt</span>
                                {evalBusy === sub.taskId ? "Triggering…" : "Eval"}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Annotated Image Preview + Moondream GT & Manual Override Modal */}
            {previewSub && (
              <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
                onClick={() => setPreviewSub(null)}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: 24, maxWidth: 760, width: "92vw", maxHeight: "90vh", overflow: "auto" }}
                  onClick={(e) => e.stopPropagation()}>

                  {/* Modal header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        Task #{previewSub.taskId + 1} Inspection &amp; AI Ground Truth
                        {previewGTBoxes.length > 0 && (
                          <span style={{ fontSize: 11, background: "rgba(255,215,0,0.15)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.3)", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                            {previewGTBoxes.length} Moondream GT {previewGTBoxes.length === 1 ? "box" : "boxes"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        Submitted by <span className="mono-tag">{previewSub.annotator.slice(0, 8)}…{previewSub.annotator.slice(-6)}</span>
                      </div>
                    </div>
                    <button className="btn-ghost btn-icon" onClick={() => setPreviewSub(null)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Layer Visibility Toggles */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "8px 12px", background: "var(--surface-high)", borderRadius: 6, border: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>Layers:</span>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "#ffd700", fontWeight: 600 }}>
                      <input type="checkbox" checked={layerVisibility.gt} onChange={(e) => setLayerVisibility(p => ({ ...p, gt: e.target.checked }))} />
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#ffd700" }}>auto_awesome</span>
                      Moondream AI Ground Truth ({previewGTBoxes.length})
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "#00e479", fontWeight: 600 }}>
                      <input type="checkbox" checked={layerVisibility.anno} onChange={(e) => setLayerVisibility(p => ({ ...p, anno: e.target.checked }))} />
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#00e479" }}>draw</span>
                      Annotator Submissions ({previewAnnotations.length})
                    </label>
                  </div>

                  {/* Image + overlaid bboxes */}
                  {previewLoading && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "var(--text-3)", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>progress_activity</span>
                      Loading image &amp; ground-truth from 0G Storage…
                    </div>
                  )}

                  {!previewLoading && previewImageUrl && (
                    <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                      <img
                        src={previewImageUrl}
                        alt="annotated"
                        style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setPreviewImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                        }}
                      />

                      {/* Render Moondream AI Ground-Truth Box Overlay Layer (Gold Dashed #ffd700) */}
                      {layerVisibility.gt && previewGTBoxes.map((gt: any, i: number) => {
                        // Coords normalized relative 0..1 or pixel
                        const relX = gt.relX ?? (gt.x > 1.0 ? gt.x / (previewImgSize?.w || 820) : gt.x);
                        const relY = gt.relY ?? (gt.y > 1.0 ? gt.y / (previewImgSize?.h || 500) : gt.y);
                        const relW = gt.relW ?? (gt.w > 1.0 ? gt.w / (previewImgSize?.w || 820) : gt.w);
                        const relH = gt.relH ?? (gt.h > 1.0 ? gt.h / (previewImgSize?.h || 500) : gt.h);

                        return (
                          <div key={`gt_${i}`} style={{
                            position: "absolute",
                            left:   `${relX * 100}%`,
                            top:    `${relY * 100}%`,
                            width:  `${relW * 100}%`,
                            height: `${relH * 100}%`,
                            border: "2px dashed #ffd700",
                            background: "rgba(255,215,0,0.12)",
                            pointerEvents: "none",
                            boxShadow: "0 0 10px rgba(255,215,0,0.4)",
                          }}>
                            <span style={{
                              position: "absolute", top: -20, left: 0,
                              background: "#ffd700", color: "#000", fontSize: 10, fontWeight: 800,
                              padding: "1px 6px", borderRadius: 2, whiteSpace: "nowrap",
                              display: "inline-flex", alignItems: "center", gap: 3,
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>auto_awesome</span>
                              AI GT: {gt.label}
                            </span>
                          </div>
                        );
                      })}

                      {/* Render Annotator Submission Box Overlay Layer (Green Solid #00e479) */}
                      {layerVisibility.anno && previewImgSize && previewAnnotations.filter((a) => a.type === "bbox" || a.x !== undefined).map((box: any, i: number) => {
                        const CANVAS_W = 680; // Matches Workspace.tsx canvas width exactly
                        const CANVAS_H = Math.round((previewImgSize.h / previewImgSize.w) * CANVAS_W);

                        const relX = box.relX ?? (box.x > 1.0 ? box.x / CANVAS_W : box.x);
                        const relY = box.relY ?? (box.y > 1.0 ? box.y / CANVAS_H : box.y);
                        const relW = box.relW ?? (box.w > 1.0 ? box.w / CANVAS_W : box.w);
                        const relH = box.relH ?? (box.h > 1.0 ? box.h / CANVAS_H : box.h);

                        return (
                          <div key={`sub_${i}`} style={{
                            position: "absolute",
                            left:   `${relX * 100}%`,
                            top:    `${relY * 100}%`,
                            width:  `${relW * 100}%`,
                            height: `${relH * 100}%`,
                            border: "2px solid #00e479",
                            background: "rgba(0,228,121,0.08)",
                            pointerEvents: "none",
                          }}>
                            <span style={{
                              position: "absolute", bottom: -20, left: 0,
                              background: "#00e479", color: "#000", fontSize: 10, fontWeight: 700,
                              padding: "1px 5px", borderRadius: 2, whiteSpace: "nowrap",
                              display: "inline-flex", alignItems: "center", gap: 3,
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>draw</span>
                              Annotator: {box.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Creator Manual Override & Custom Settlement Panel */}
                  {marketV2 && previewTaskSubmissions.length > 0 && (
                    <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary)" }}>tune</span>
                        Human Override — Custom Onchain Reward Settlement
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
                        As the job creator, you can manually adjust the percentage reward split and override AI scores directly onchain.
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                        {previewTaskSubmissions.map((ts: any, idx: number) => {
                          const addrKey = ts.annotator.toLowerCase();
                          const currentBps = customSharesBps[addrKey] ?? ts.reward_share_bps ?? 0;
                          const currentPct = (currentBps / 100).toFixed(0);

                          return (
                            <div key={ts.annotator} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--surface-high)", borderRadius: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", fontFamily: "monospace" }}>
                                Annotator #{idx + 1} ({ts.annotator.slice(0, 6)}…{ts.annotator.slice(-4)})
                              </span>
                              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                                IoU: {ts.iou_score ? `${(ts.iou_score * 100).toFixed(1)}%` : "N/A"}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={currentPct}
                                  onChange={(e) => {
                                    const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                    setCustomSharesBps(p => ({ ...p, [addrKey]: pct * 100 }));
                                  }}
                                  style={{ width: 60, padding: "4px 8px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: 12, textAlign: "center", fontWeight: 700 }}
                                />
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        className="btn-primary btn-sm"
                        disabled={overrideBusy}
                        onClick={async () => {
                          if (!marketV2 || !selected) return;
                          setOverrideBusy(true);
                          try {
                            const annotators = previewTaskSubmissions.map((s: any) => s.annotator);
                            const shares = annotators.map((a: string) => customSharesBps[a.toLowerCase()] || 0);

                            setTxMsg(`Submitting custom reward settlement onchain…`);
                            setTxErr(false);
                            const tx = await marketV2.distributeRewards(selected.jobId, previewSub.taskId, annotators, shares);
                            setTxMsg(`✓ Custom settlement confirmed onchain — tx ${tx.hash}`);
                            setPreviewSub(null);
                            await loadSubs(selected);
                          } catch (e: any) {
                            setTxMsg(`Manual settlement failed: ${e.message}`);
                            setTxErr(true);
                          } finally {
                            setOverrideBusy(false);
                          }
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>bolt</span>
                        {overrideBusy ? "Signing Tx…" : "Submit Custom Onchain Settlement"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Publish Modal Overlay */}
            {publishing && (
              <div style={{
                position: "fixed", inset: 0, zIndex: 1000,
                background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
              }}>
                <div style={{
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                  maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", gap: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 24 }}>publish</span>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text)" }}>Publish as Decentralized Dataset</h3>
                    </div>
                    <button className="btn-ghost" onClick={() => setPublishing(false)} disabled={pubBusy} style={{ padding: 4 }}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Dataset Health Check — shown in modal */}
                  {selected.dataType === 0 && healthLabels.length > 0 && (
                    <div>
                      <DatasetHealthCard
                        annotations={annotationCache}
                        totalTasks={selected.taskCount}
                        labels={healthLabels}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Dataset Name</label>
                      <input type="text" disabled={pubBusy} placeholder={`Dataset from Job #${selected.jobId}`} value={publishForm.name} onChange={(e) => setPublishForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Labels (comma-separated)</label>
                      <input type="text" disabled={pubBusy} placeholder="car, person, building" value={publishForm.labels}
                        onChange={(e) => setPublishForm((f) => ({ ...f, labels: e.target.value }))} />
                      <p className="hint" style={{ marginTop: 4 }}>Used to build COCO categories</p>
                    </div>
                    <div>
                      <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Price (0G) — 0 for free</label>
                      <input type="number" disabled={pubBusy} step="0.01" min="0" value={publishForm.price} onChange={(e) => setPublishForm((f) => ({ ...f, price: e.target.value }))} />
                    </div>

                    {txMsg && (
                      <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 12, background: txErr ? "rgba(255,107,107,0.1)" : "rgba(0,228,121,0.1)", color: txErr ? "var(--error)" : "var(--primary)", border: `1px solid ${txErr ? "var(--error)" : "var(--primary)"}` }}>
                        {txMsg}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                      <button className="btn-primary" onClick={() => publishDataset(selected)} disabled={pubBusy} style={{ flex: 1, justifyContent: "center" }}>
                        {pubBusy ? "Uploading & Registering on 0G Storage…" : "Publish Dataset to Universe"}
                      </button>
                      <button className="btn-secondary" onClick={() => setPublishing(false)} disabled={pubBusy}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Animated Dataset Creation Loading Modal */}
      <DatasetCreationModal
        isOpen={pubBusy}
        currentStep={txMsg || "Compiling images & annotations into dataset package…"}
        subStatus="Packing dataset archive & pinning to 0G Storage…"
        dataType={selected?.dataType === 1 ? "text" : "image"}
      />
    </div>
  );
}
