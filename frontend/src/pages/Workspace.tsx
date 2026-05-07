import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Transformer } from "react-konva";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarket } from "../hooks/useAnnotationMarket";
import { uploadJson } from "../hooks/useStorage";
import { GALILEO } from "../config";

// ── Types ────────────────────────────────────────────────────────────────────

type BBox = { id: string; type: "bbox"; x: number; y: number; w: number; h: number; label: string };
type Polygon = { id: string; type: "polygon"; points: number[]; label: string; closed: boolean };
type Annotation = BBox | Polygon;

const CANVAS_W = 680;
const uid = () => Math.random().toString(36).slice(2, 8);

// ── Image Annotation Workspace ───────────────────────────────────────────────

function ImageWorkspace({
  imageUrl, labels, taskId, jobId, totalTasks, savedAnnotations,
  onSubmit, onNext, onPrev,
}: {
  imageUrl: string; labels: string[]; taskId: number; jobId: number; totalTasks: number;
  savedAnnotations?: any;
  onSubmit: (annotations: Annotation[]) => void;
  onNext: () => void; onPrev: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<"bbox" | "polygon">("bbox");
  const [activeLabel, setActiveLabel] = useState(labels[0] ?? "object");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [polyPoints, setPolyPoints] = useState<number[]>([]);
  const [scale, setScale] = useState(1);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const rectRefs = useRef<Record<string, any>>({});

  // Attach transformer to selected bbox
  useEffect(() => {
    if (!trRef.current) return;
    if (selectedId && rectRefs.current[selectedId]) {
      trRef.current.nodes([rectRefs.current[selectedId]]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, annotations]);

  // Reset annotations when task changes — load from savedAnnotations or localStorage
  useEffect(() => {
    if (savedAnnotations) {
      setAnnotations(savedAnnotations);
    } else {
      const saved = localStorage.getItem(`draft-${jobId}-${taskId}`);
      setAnnotations(saved ? JSON.parse(saved) : []);
    }
    setSelectedId(null);
    setPolyPoints([]);
    setDrawing(false);
  }, [taskId, jobId]);

  const CANVAS_H = img ? Math.round((img.naturalHeight / img.naturalWidth) * CANVAS_W) : 400;

  useEffect(() => {
    const image = new window.Image();
    image.src = imageUrl;
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
  }, [imageUrl]);

  // Save draft on every change
  useEffect(() => {
    localStorage.setItem(`draft-${jobId}-${taskId}`, JSON.stringify(annotations));
  }, [annotations, jobId, taskId]);

  // Delete selected on Delete/Backspace key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        setAnnotations((a) => a.filter((x) => x.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  function getPos() {
    const pos = stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: pos.x / scale, y: pos.y / scale };
  }

  function handleStageMouseDown(e: any) {
    // Click on empty area → deselect
    if (e.target === e.target.getStage() || e.target.getClassName() === "Image") {
      setSelectedId(null);
      if (tool === "bbox") {
        setDrawStart(getPos());
        setDrawing(true);
      } else if (tool === "polygon") {
        const pos = getPos();
        setPolyPoints((pts) => [...pts, pos.x, pos.y]);
      }
    }
  }

  function handleStageMouseUp() {
    if (tool === "bbox" && drawing) {
      const end = getPos();
      const box: BBox = {
        id: uid(), type: "bbox",
        x: Math.min(drawStart.x, end.x),
        y: Math.min(drawStart.y, end.y),
        w: Math.abs(end.x - drawStart.x),
        h: Math.abs(end.y - drawStart.y),
        label: activeLabel,
      };
      if (box.w > 5 && box.h > 5) {
        setAnnotations((a) => [...a, box]);
        setSelectedId(box.id);
      }
      setDrawing(false);
    }
  }

  function closePolygon() {
    if (polyPoints.length < 6) return;
    const poly: Polygon = { id: uid(), type: "polygon", points: polyPoints, label: activeLabel, closed: true };
    setAnnotations((a) => [...a, poly]);
    setSelectedId(poly.id);
    setPolyPoints([]);
  }

  function updateLabel(id: string, label: string) {
    setAnnotations((a) => a.map((x) => x.id === id ? { ...x, label } : x));
    setEditingLabel(null);
  }

  function deleteAnnotation(id: string) {
    setAnnotations((a) => a.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const COLORS: Record<string, string> = {};
  const palette = ["#00ff88", "#ff6b6b", "#ffd700", "#00bfff", "#ff69b4", "#7fff00"];
  labels.forEach((l, i) => { COLORS[l] = palette[i % palette.length]; });
  const color = (label: string) => COLORS[label] ?? "#00ff88";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      {/* Floating toolbar */}
      <div style={{
        position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)",
        zIndex: 20, display: "flex", alignItems: "center",
        background: "rgba(24,34,26,0.92)", backdropFilter: "blur(8px)",
        border: "1px solid var(--border)", borderRadius: 8, padding: 4, gap: 4,
      }}>
        {/* Select tool */}
        <button className="btn-ghost btn-icon" title="Select">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_selector_tool</span>
        </button>
        <div className="divider-v" style={{ margin: "0 4px" }} />
        {/* Box tool */}
        <button onClick={() => setTool("bbox")} title="Bounding Box"
          style={{ padding: 8, borderRadius: 4, border: "none", cursor: "pointer", background: tool === "bbox" ? "var(--primary)" : "transparent", color: tool === "bbox" ? "var(--on-primary)" : "var(--text-2)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_box_outline_blank</span>
        </button>
        {/* Polygon tool */}
        <button onClick={() => { setTool("polygon"); setPolyPoints([]); }} title="Polygon"
          style={{ padding: 8, borderRadius: 4, border: "none", cursor: "pointer", background: tool === "polygon" ? "var(--primary)" : "transparent", color: tool === "polygon" ? "var(--on-primary)" : "var(--text-2)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>polyline</span>
        </button>
        <div className="divider-v" style={{ margin: "0 4px" }} />
        {/* Label selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderRight: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>{activeLabel}</span>
          <select value={activeLabel} onChange={(e) => setActiveLabel(e.target.value)}
            style={{ background: "transparent", border: "none", color: "var(--text-2)", fontSize: 12, cursor: "pointer", outline: "none", width: 16 }}>
            {labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        {/* Zoom */}
        <button className="btn-ghost btn-icon" onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} title="Zoom Out">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>zoom_out</span>
        </button>
        <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--text-2)", minWidth: 36, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
        <button className="btn-ghost btn-icon" onClick={() => setScale((s) => Math.min(s + 0.25, 3))} title="Zoom In">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>zoom_in</span>
        </button>
        {tool === "polygon" && polyPoints.length >= 6 && (
          <><div className="divider-v" style={{ margin: "0 4px" }} /><button className="btn-primary btn-sm" onClick={closePolygon}>Close</button></>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas area */}
        <div style={{ flex: 1, background: "var(--bg)", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", cursor: "crosshair", position: "relative" }}>
          <Stage
            ref={stageRef}
            width={CANVAS_W * scale}
            height={CANVAS_H * scale}
            scaleX={scale} scaleY={scale}
            onMouseDown={handleStageMouseDown}
            onMouseUp={handleStageMouseUp}
          >
            <Layer>
              {img && <KonvaImage image={img} width={CANVAS_W} height={CANVAS_H} />}
              {annotations.filter((a) => a.type === "bbox").map((a) => {
                const b = a as BBox;
                const isSelected = selectedId === b.id;
                return (
                  <React.Fragment key={b.id}>
                    <Rect
                      ref={(node) => { if (node) rectRefs.current[b.id] = node; }}
                      x={b.x} y={b.y} width={b.w} height={b.h}
                      stroke={color(b.label)} strokeWidth={isSelected ? 3 : 2}
                      fill={`${color(b.label)}18`}
                      onClick={() => setSelectedId(b.id)}
                      draggable
                      onDragEnd={(e) => setAnnotations((prev) => prev.map((x) =>
                        x.id === b.id ? { ...b, x: e.target.x(), y: e.target.y() } : x
                      ))}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        setAnnotations((prev) => prev.map((x) =>
                          x.id === b.id ? {
                            ...b,
                            x: node.x(), y: node.y(),
                            w: Math.max(5, node.width() * scaleX),
                            h: Math.max(5, node.height() * scaleY),
                          } : x
                        ));
                      }}
                    />
                    <Text x={b.x + 4} y={b.y + 4} text={b.label} fill={color(b.label)} fontSize={12} />
                  </React.Fragment>
                );
              })}
              {annotations.filter((a) => a.type === "polygon").map((a) => {
                const p = a as Polygon;
                return <Line key={p.id} points={p.points} stroke={color(p.label)} strokeWidth={selectedId === p.id ? 3 : 2} fill={`${color(p.label)}18`} closed={p.closed} onClick={() => setSelectedId(p.id)} />;
              })}
              {polyPoints.length > 0 && (
                <>
                  <Line points={polyPoints} stroke="#fff" strokeWidth={2} dash={[4, 4]} />
                  {polyPoints.filter((_, i) => i % 2 === 0).map((x, i) => <Circle key={i} x={x} y={polyPoints[i * 2 + 1]} radius={4} fill="#fff" />)}
                </>
              )}
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                borderStroke="var(--primary)"
                anchorStroke="var(--primary)"
                anchorFill="#fff"
                anchorSize={8}
                anchorCornerRadius={2}
              />
            </Layer>
          </Stage>
        </div>

        {/* Right sidebar: annotations + properties */}
        <aside style={{ width: 240, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
          {/* Annotations list */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="label-caps">Annotations ({annotations.length})</span>
            {annotations.length > 0 && (
              <button onClick={() => { setAnnotations([]); setSelectedId(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--text-3)" }}>
                Clear all
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
            {annotations.length === 0 && <p className="hint" style={{ padding: 12 }}>Draw boxes on the image.</p>}
            {annotations.map((a) => (
              <div key={a.id} onClick={() => setSelectedId(a.id)}
                style={{
                  padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  background: selectedId === a.id ? "var(--surface-high)" : "transparent",
                  borderLeft: selectedId === a.id ? `2px solid ${color(a.label)}` : "2px solid transparent",
                }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color(a.label), flexShrink: 0 }} />
                {editingLabel === a.id ? (
                  <select autoFocus value={a.label}
                    onChange={(e) => updateLabel(a.id, e.target.value)}
                    onBlur={() => setEditingLabel(null)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: "var(--surface-high)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 2, fontSize: 12, flex: 1 }}>
                    {labels.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}
                    onClick={(e) => { e.stopPropagation(); setEditingLabel(a.id); }}>
                    {a.label}
                    {a.type === "bbox" && <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 4 }}>
                      {Math.round((a as BBox).w)}×{Math.round((a as BBox).h)}
                    </span>}
                  </span>
                )}
                <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(a.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--error)" }}>delete</span>
                </button>
              </div>
            ))}
          </div>

          {/* Save & Next */}
          <div style={{ padding: 12, background: "var(--surface-high)", borderTop: "1px solid var(--border)" }}>
            <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}
              onClick={() => onSubmit(annotations)}>
              Save & Next
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Bottom nav */}
      <div style={{ height: 56, background: "var(--surface-high)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn-ghost" onClick={onPrev} disabled={taskId === 0} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            <span className="label-caps">Prev</span>
          </button>
          <div className="divider-v" />
          <button className="btn-ghost" onClick={onNext} disabled={taskId >= totalTasks - 1} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="label-caps">Next</span>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, maxWidth: 400 }}>
          <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
            Progress: {Math.round(((taskId + 1) / totalTasks) * 100)}%
          </span>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${((taskId + 1) / totalTasks) * 100}%` }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-3)" }}>bolt</span>
          <span className="label-caps">Fast Path Enabled</span>
        </div>
      </div>
    </div>
  );
}

// Need React for Fragment
import React from "react";

// ── Text Annotation Workspace ────────────────────────────────────────────────

function TextWorkspace({
  text, labels, taskId, jobId, totalTasks,
  onSubmit, onNext, onPrev,
}: {
  text: string; labels: string[]; taskId: number; jobId: number; totalTasks: number;
  onSubmit: (result: { label: string }) => void;
  onNext: () => void; onPrev: () => void;
}) {
  const saved = localStorage.getItem(`draft-text-${jobId}-${taskId}`);
  const [selected, setSelected] = useState(saved ?? labels[0] ?? "");

  useEffect(() => {
    localStorage.setItem(`draft-text-${jobId}-${taskId}`, selected);
  }, [selected, jobId, taskId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-2)", marginBottom: 20, whiteSpace: "pre-wrap" }}>
          {text}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {labels.map((l) => (
            <button key={l} onClick={() => setSelected(l)}
              style={{
                padding: "8px 20px", borderRadius: 4, border: "1px solid",
                borderColor: selected === l ? "var(--primary)" : "var(--border)",
                background: selected === l ? "var(--primary-bg)" : "transparent",
                color: selected === l ? "var(--primary)" : "var(--text-2)",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
              {l}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => onSubmit({ label: selected })} disabled={!selected}>
          Save & Next
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </button>
      </div>
      {/* Bottom nav */}
      <div style={{ height: 56, background: "var(--surface-high)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn-ghost" onClick={onPrev} disabled={taskId === 0} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            <span className="label-caps">Prev</span>
          </button>
          <div className="divider-v" />
          <button className="btn-ghost" onClick={onNext} disabled={taskId >= totalTasks - 1} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="label-caps">Next</span>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, maxWidth: 400 }}>
          <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
            Task {taskId + 1} / {totalTasks}
          </span>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${((taskId + 1) / totalTasks) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Workspace Page ──────────────────────────────────────────────────────

export default function Workspace() {
  const { jobId: jobIdStr, taskId: taskIdStr } = useParams<{ jobId: string; taskId: string }>();
  const navigate = useNavigate();
  const { signer } = useWallet();
  const market = useAnnotationMarket(signer);

  const [job, setJob] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [allTaskData, setAllTaskData] = useState<any[]>([]);
  const [taskId, setTaskId] = useState(Number(taskIdStr ?? 0));
  // Collect all annotations locally — submit as one batch tx at the end
  const [draftAnnotations, setDraftAnnotations] = useState<Record<number, any>>({});
  const [step, setStep] = useState<"idle" | "uploading" | "submitting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const jobId = Number(jobIdStr ?? 0);

  useEffect(() => {
    if (!market) return;
    loadJob();
  }, [!!market, jobId]);

  async function loadJob() {
    if (!market) return;
    try {
      const j = await market.getJob(jobId);
      setJob(j);
      const metaRes = await fetch(`https://indexer-storage-testnet-turbo.0g.ai/file?root=${j.metadataURI}`).catch(() => null);
      if (metaRes?.ok) {
        const meta = await metaRes.json();
        setMetadata(meta);
        const dataRes = await fetch(`https://indexer-storage-testnet-turbo.0g.ai/file?root=${j.dataRootHash}`).catch(() => null);
        if (dataRes?.ok) setAllTaskData(await dataRes.json());
      }
    } catch (e: any) {
      setError(`Failed to load: ${e.message}`);
    }
  }

  // Save annotation for current task locally, move to next
  function handleSaveAndNext(annotation: Annotation[] | { label: string }) {
    setDraftAnnotations((prev) => ({ ...prev, [taskId]: annotation }));
    localStorage.setItem(`draft-${jobId}-${taskId}`, JSON.stringify(annotation));
    if (taskId < totalTasks - 1) {
      goToTask(taskId + 1);
    }
  }

  // Upload all drafts to 0G Storage in parallel, then one batch tx
  async function handleSubmitAll() {
    if (!market || !signer) return;
    const annotatedIds = Object.keys(draftAnnotations).map(Number);
    if (annotatedIds.length === 0) return;

    setStep("uploading");
    setError("");
    try {
      // Upload annotations sequentially — parallel uploads cause nonce conflicts
      const uploads: { taskId: number; rootHash: string }[] = [];
      for (const tid of annotatedIds) {
        const rootHash = await uploadJson({ jobId, taskId: tid, annotation: draftAnnotations[tid], timestamp: Date.now() });
        uploads.push({ taskId: tid, rootHash });
      }

      // One batch transaction — one MetaMask signature
      setStep("submitting");
      const taskIds = uploads.map((u) => u.taskId);
      const rootHashes = uploads.map((u) => u.rootHash);
      const receipt = await market.submitBatch(jobId, taskIds, rootHashes);

      // Clear all drafts
      annotatedIds.forEach((tid) => {
        localStorage.removeItem(`draft-${jobId}-${tid}`);
        localStorage.removeItem(`draft-text-${jobId}-${tid}`);
      });
      setDraftAnnotations({});
      setTxHash(receipt.hash);
      setStep("done");
    } catch (e: any) {
      setError(e.message);
      setStep("error");
    }
  }

  function goToTask(id: number) {
    setTaskId(id);
    setStep("idle");
    setTxHash("");
    navigate(`/jobs/${jobId}/${id}`, { replace: true });
  }

    
  const labels: string[] = metadata?.labels ?? ["object"];

  if (step === "done") {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: 80 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--primary)", display: "block", marginBottom: 16 }}>check_circle</span>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>All Annotations Submitted</h2>
        <a href={`${GALILEO.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ marginRight: 12 }}>View Tx ↗</a>
        <button className="btn-primary" onClick={() => navigate("/")}>Back to Jobs</button>
      </div>
    );
  }

  const totalTasks = job ? Number(job.taskCount) : 1;
  const annotatedCount = Object.keys(draftAnnotations).length;
  const isImage = job ? Number(job.dataType) === 0 : true;
  const taskData = allTaskData[taskId];
  const imageUrl = taskData ? `data:${taskData.type};base64,${taskData.data}` : "";
  const textContent = taskData?.data ? atob(taskData.data) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      {/* Workspace header bar */}
      <div style={{ height: 48, background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn-ghost" onClick={() => navigate("/")} style={{ padding: "4px 0" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          </button>
          <div className="divider-v" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Job #{jobId}: {isImage ? "Image" : "Text"} Annotation</div>
            <div className="label-caps">Task {taskId + 1}/{totalTasks}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {error && <span style={{ color: "var(--error)", fontSize: 12 }}>{error}</span>}
          {(step === "uploading" || step === "submitting") && (
            <span style={{ color: "var(--text-2)", fontSize: 12 }}>{step === "uploading" ? "Uploading…" : "Signing…"}</span>
          )}
          {annotatedCount > 0 && step === "idle" && (
            <button className="btn-primary" onClick={handleSubmitAll}>
              Submit All ({annotatedCount}) — 1 signature
            </button>
          )}
        </div>
      </div>

      {/* Loading states */}
      {!job && !error && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><p className="hint">Loading job…</p></div>}
      {job && !taskData && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><p className="hint">Loading task data from 0G Storage…</p></div>}

      {/* Left sidebar: workspace tools */}
      {job && taskData && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <aside style={{ width: 240, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
              <span className="label-caps">Workspace</span>
            </div>
            <nav style={{ flex: 1, overflowY: "auto" }}>
              {/* Task overview — done/pending per task */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary)" }}>task_alt</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Tasks</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from({ length: totalTasks }).map((_, i) => {
                    const isDone = draftAnnotations[i] !== undefined;
                    const isCurrent = i === taskId;
                    return (
                      <div key={i} onClick={() => goToTask(i)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                          borderRadius: 4, cursor: "pointer",
                          background: isCurrent ? "var(--primary-bg)" : "transparent",
                          border: isCurrent ? "1px solid rgba(0,228,121,0.3)" : "1px solid transparent",
                        }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: isDone ? "var(--primary)" : "var(--text-3)" }}>
                          {isDone ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span style={{ fontSize: 12, color: isCurrent ? "var(--primary)" : isDone ? "var(--text)" : "var(--text-3)" }}>
                          Task {i + 1}
                        </span>
                        {isDone && (
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--primary)", fontWeight: 700 }}>
                            {Array.isArray(draftAnnotations[i]) ? `${draftAnnotations[i].length} ann.` : "done"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Labels legend */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-3)" }}>label</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Labels</span>
                </div>
                {labels.map((l, i) => {
                  const palette = ["#00e479", "#ff6b6b", "#ffd700", "#00bfff", "#ff69b4", "#7fff00"];
                  const c = palette[i % palette.length];
                  return (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{l}</span>
                    </div>
                  );
                })}
              </div>

              {/* Instructions */}
              {metadata?.instructions && (
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-3)" }}>info</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Instructions</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{metadata.instructions}</p>
                </div>
              )}
            </nav>

            {/* Submit all button */}
            <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, textAlign: "center" }}>
                {annotatedCount}/{totalTasks} tasks annotated
              </div>
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setShowPreview(true)}
                disabled={annotatedCount === 0 || step === "uploading" || step === "submitting"}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
                Review & Submit
              </button>
            </div>
          </aside>

          {/* Main canvas / text area */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {isImage && (
              <ImageWorkspace
                imageUrl={imageUrl} labels={labels}
                taskId={taskId} jobId={jobId} totalTasks={totalTasks}
                savedAnnotations={draftAnnotations[taskId]}
                onSubmit={handleSaveAndNext}
                onNext={() => goToTask(taskId + 1)}
                onPrev={() => goToTask(taskId - 1)}
              />
            )}
            {!isImage && (
              <TextWorkspace
                text={textContent} labels={labels}
                taskId={taskId} jobId={jobId} totalTasks={totalTasks}
                onSubmit={handleSaveAndNext}
                onNext={() => goToTask(taskId + 1)}
                onPrev={() => goToTask(taskId - 1)}
              />
            )}
          </div>
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowPreview(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 24, width: 480, maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Review Before Submitting</h3>
              <button className="btn-ghost btn-icon" onClick={() => setShowPreview(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {Array.from({ length: totalTasks }).map((_, i) => {
                const isDone = draftAnnotations[i] !== undefined;
                const count = Array.isArray(draftAnnotations[i]) ? draftAnnotations[i].length : isDone ? 1 : 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-low)", border: `1px solid ${isDone ? "rgba(0,228,121,0.3)" : "var(--border)"}`, borderRadius: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: isDone ? "var(--primary)" : "var(--text-3)" }}>
                        {isDone ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span style={{ fontSize: 13, color: isDone ? "var(--text)" : "var(--text-3)" }}>Task {i + 1}</span>
                    </div>
                    {isDone
                      ? <span style={{ fontSize: 12, color: "var(--primary)", fontFamily: "'Space Grotesk', monospace" }}>{count} annotation{count !== 1 ? "s" : ""}</span>
                      : <button className="btn-ghost btn-sm" onClick={() => { setShowPreview(false); goToTask(i); }}>Annotate</button>
                    }
                  </div>
                );
              })}
            </div>
            <div style={{ background: "var(--surface-low)", border: "1px solid var(--border)", borderRadius: 4, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--text-2)" }}>
              <strong style={{ color: "var(--text)" }}>{annotatedCount}</strong> of <strong style={{ color: "var(--text)" }}>{totalTasks}</strong> tasks annotated.
              {annotatedCount < totalTasks && <span style={{ color: "var(--warn)", marginLeft: 8 }}>{totalTasks - annotatedCount} task(s) will be skipped.</span>}
            </div>
            {error && <p style={{ color: "var(--error)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowPreview(false)}>Continue Annotating</button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }}
                onClick={() => { setShowPreview(false); handleSubmitAll(); }}
                disabled={annotatedCount === 0 || step === "uploading" || step === "submitting"}>
                {step === "uploading" ? "Uploading…" : step === "submitting" ? "Signing…" : `Submit ${annotatedCount} Tasks`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
