import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Transformer } from "react-konva";
import { useWallet } from "../hooks/useWallet";
import { useAnnotationMarketV2 } from "../hooks/useAnnotationMarketV2";
import { uploadJson, fetchFrom0GStorage } from "../hooks/useStorage";
import { GALILEO, RELAYER_API_URL } from "../config";

// ── Types ────────────────────────────────────────────────────────────────────

type BBox = { id: string; type: "bbox"; x: number; y: number; w: number; h: number; relX?: number; relY?: number; relW?: number; relH?: number; label: string };
type Polygon = { id: string; type: "polygon"; points: number[]; label: string; closed: boolean };
type Annotation = BBox | Polygon;

const CANVAS_W = 680;
const uid = () => Math.random().toString(36).slice(2, 8);

function safeStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      // Purge stale 0g cache and draft entries to free quota
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("0g_cache_") || (k.startsWith("draft-") && !k.includes(key)))) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem(key, value);
    } catch {}
  }
}

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ── Image Annotation Workspace ───────────────────────────────────────────────

function ImageWorkspace({
  imageUrl, labels, taskId, jobId, totalTasks, savedAnnotations, userAlreadySubmitted,
  onSubmit, onNext, onPrev,
}: {
  imageUrl: string; labels: string[]; taskId: number; jobId: number; totalTasks: number;
  savedAnnotations?: any; userAlreadySubmitted?: boolean;
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

  const currentTaskIdRef = useRef(taskId);

  // Reset annotations when task changes — load from savedAnnotations or localStorage
  useEffect(() => {
    currentTaskIdRef.current = taskId;
    if (savedAnnotations && Array.isArray(savedAnnotations)) {
      setAnnotations(savedAnnotations);
    } else {
      const saved = safeStorageGet(`draft-${jobId}-${taskId}`);
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

  // Save draft on every change — ONLY for current active task
  useEffect(() => {
    if (currentTaskIdRef.current === taskId) {
      safeStorageSet(`draft-${jobId}-${taskId}`, JSON.stringify(annotations));
    }
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
      const bx = Math.min(drawStart.x, end.x);
      const by = Math.min(drawStart.y, end.y);
      const bw = Math.abs(end.x - drawStart.x);
      const bh = Math.abs(end.y - drawStart.y);

      const box: BBox = {
        id: uid(), type: "bbox",
        x: bx,
        y: by,
        w: bw,
        h: bh,
        relX: bx / CANVAS_W,
        relY: by / CANVAS_H,
        relW: bw / CANVAS_W,
        relH: bh / CANVAS_H,
        canvasW: CANVAS_W,
        canvasH: CANVAS_H,
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

  const isLastTask = taskId >= totalTasks - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas area */}
        <div style={{ flex: 1, background: "var(--bg)", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", cursor: "crosshair", position: "relative" }}>

          {/* Warning banner if user has already submitted this task */}
          {userAlreadySubmitted && (
            <div style={{
              width: "100%", padding: "10px 16px", background: "rgba(255,219,121,0.12)",
              borderBottom: "1px solid rgba(255,219,121,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              color: "var(--warn)", fontSize: 13, fontWeight: 600, zIndex: 30,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
              You have already submitted an annotation for Task #{taskId + 1}. Re-submitting is blocked onchain.
            </div>
          )}

          {/* Toolbar — anchored inside canvas, not over full page */}
          <div style={{
            position: "sticky", top: 0, zIndex: 20,
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "6px 12px",
            background: "rgba(12,22,14,0.88)", backdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--border)",
            gap: 2, flexShrink: 0,
          }}>
            {/* Select tool */}
            <button className="btn-ghost btn-icon" title="Select (V)" style={{ padding: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_selector_tool</span>
            </button>
            <div className="divider-v" style={{ margin: "0 6px" }} />
            {/* Box tool */}
            <button onClick={() => setTool("bbox")} title="Bounding Box (B)"
              style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid", cursor: "pointer",
                borderColor: tool === "bbox" ? "var(--primary)" : "transparent",
                background: tool === "bbox" ? "var(--primary-bg)" : "transparent",
                color: tool === "bbox" ? "var(--primary)" : "var(--text-2)",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>check_box_outline_blank</span>
              Box
            </button>
            {/* Polygon tool */}
            <button onClick={() => { setTool("polygon"); setPolyPoints([]); }} title="Polygon (P)"
              style={{ padding: "5px 8px", borderRadius: 4, border: "1px solid", cursor: "pointer",
                borderColor: tool === "polygon" ? "var(--primary)" : "transparent",
                background: tool === "polygon" ? "var(--primary-bg)" : "transparent",
                color: tool === "polygon" ? "var(--primary)" : "var(--text-2)",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>polyline</span>
              Polygon
            </button>
            <div className="divider-v" style={{ margin: "0 6px" }} />
            {/* Label selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border)",
              background: "var(--surface)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>label</span>
              <select value={activeLabel} onChange={(e) => setActiveLabel(e.target.value)}
                style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 12, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                {labels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="divider-v" style={{ margin: "0 6px" }} />
            {/* Zoom */}
            <button className="btn-ghost btn-icon" onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} title="Zoom Out" style={{ padding: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>zoom_out</span>
            </button>
            <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, color: "var(--text-2)", minWidth: 34, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
            <button className="btn-ghost btn-icon" onClick={() => setScale((s) => Math.min(s + 0.25, 3))} title="Zoom In" style={{ padding: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>zoom_in</span>
            </button>
            {tool === "polygon" && polyPoints.length >= 6 && (
              <><div className="divider-v" style={{ margin: "0 6px" }} />
              <button className="btn-primary btn-sm" onClick={closePolygon} style={{ fontSize: 11, padding: "3px 8px" }}>Close Shape</button></>
            )}
          </div>

          {/* Canvas scroll area */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", width: "100%" }}>
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
          </div>{/* end canvas scroll area */}
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

          {/* Save & Next / Save & Submit on last task */}
          <div style={{ padding: 12, background: "var(--surface-high)", borderTop: "1px solid var(--border)" }}>
            <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}
              onClick={() => onSubmit(annotations)}
              disabled={userAlreadySubmitted}
              title={userAlreadySubmitted ? "Task already submitted onchain" : ""}>
              {userAlreadySubmitted ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>Already Submitted</>
              ) : isLastTask ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>Save & Submit</>
              ) : (
                <>Save & Next<span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span></>
              )}
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
  const saved = safeStorageGet(`draft-text-${jobId}-${taskId}`);
  const [selected, setSelected] = useState(saved ?? labels[0] ?? "");

  useEffect(() => {
    safeStorageSet(`draft-text-${jobId}-${taskId}`, selected);
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

export default function Workspace() {
  const { jobId: jobIdStr, taskId: taskIdStr } = useParams<{ jobId: string; taskId: string }>();
  const navigate = useNavigate();
  const { signer } = useWallet();
  const marketV2 = useAnnotationMarketV2(signer);

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
  // Per-task upload progress: maps taskId → "pending" | "uploading" | "done" | "error"
  const [uploadProgress, setUploadProgress] = useState<Record<number, string>>({});
  const [uploadCount, setUploadCount] = useState(0);
  // Cache of successfully uploaded task rootHashes (tid -> rootHash)
  const [uploadedHashes, setUploadedHashes] = useState<Record<number, string>>({});
  // V2: track submission count per task (from indexer REST API)
  const [taskSubCounts, setTaskSubCounts] = useState<Record<number, number>>({});
  // Track tasks already submitted by the connected wallet address
  const [userSubmittedTasks, setUserSubmittedTasks] = useState<Set<number>>(new Set());

  const { address: userWalletAddress } = useWallet();
  const jobId = Number(jobIdStr ?? 0);

  useEffect(() => {
    if (!marketV2) return;
    loadJob();
  }, [!!marketV2, jobId]);

  // Fetch tasks already submitted by current wallet address
  useEffect(() => {
    if (!userWalletAddress || !job) return;
    fetch(`${RELAYER_API_URL}/annotations/annotator/${userWalletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data?.submissions)) {
          const submitted = new Set<number>();
          data.submissions.forEach((s: any) => {
            if (s.job_id === jobId) submitted.add(s.task_id);
          });
          setUserSubmittedTasks(submitted);
        }
      })
      .catch(() => {});
  }, [userWalletAddress, job, jobId]);

  // Fetch submission counts from indexer for slot indicators
  useEffect(() => {
    if (!job) return;
    const count = Number(job.taskCount);
    Promise.all(
      Array.from({ length: count }).map(async (_, i) => {
        try {
          const res = await fetch(`${RELAYER_API_URL}/annotations/task/${jobId}/${i}`);
          if (res.ok) {
            const data = await res.json();
            return [i, data.submissionCount ?? 0] as [number, number];
          }
        } catch {}
        return [i, 0] as [number, number];
      })
    ).then((entries) => {
      const map: Record<number, number> = {};
      entries.forEach(([i, c]) => { map[i] = c; });
      setTaskSubCounts(map);
    });
  }, [job, jobId]);

  async function loadJob() {
    try {
      if (!marketV2) throw new Error("V2 Marketplace not initialized");
      const v2j = await marketV2.getJob(jobId);
      if (!v2j || v2j.creator === "0x0000000000000000000000000000000000000000") {
        throw new Error("Job not found");
      }
      const j = { ...v2j, isV2: true };
      setJob(j);

      // Resilient 0G storage fetching with retries and multiple indexer fallback
      const [metaResult, dataResult] = await Promise.allSettled([
        fetchFrom0GStorage(j.metadataURI, 5),
        fetchFrom0GStorage(j.dataRootHash, 5),
      ]);

      if (metaResult.status === "fulfilled") setMetadata(metaResult.value);
      if (dataResult.status === "fulfilled") {
        const val = dataResult.value;
        if (Array.isArray(val) && val.length > 0) {
          setAllTaskData(val);
        } else if (val && typeof val === "object" && Array.isArray(val.files) && val.files.length > 0) {
          setAllTaskData(val.files);
        } else {
          setError("0G Storage returned an empty or invalid dataset format for this job.");
        }
      } else {
        const reason = dataResult.status === "rejected" ? dataResult.reason?.message : "Unknown error";
        setError(`Failed to retrieve task dataset from 0G Storage (${reason}).`);
      }
    } catch (e: any) {
      setError(`Failed to load: ${e.message}`);
    }
  }

  // Save annotation for current task locally, move to next
  // On last task: auto-open the review+submit modal
  function handleSaveAndNext(annotation: Annotation[] | { label: string }) {
    const updatedDrafts = { ...draftAnnotations, [taskId]: annotation };
    setDraftAnnotations(updatedDrafts);
    safeStorageSet(`draft-${jobId}-${taskId}`, JSON.stringify(annotation));
    if (taskId < totalTasks - 1) {
      goToTask(taskId + 1);
    } else {
      // Last task saved — open review modal automatically
      setShowPreview(true);
    }
  }

  // Upload all drafts to 0G Storage sequentially, then one batch tx
  async function handleSubmitAll(draftsOverride?: Record<number, any>) {
    if (!marketV2) return;
    if (!signer) return;
    const drafts = draftsOverride ?? draftAnnotations;
    const annotatedIds = Object.keys(drafts).map(Number);
    if (annotatedIds.length === 0) return;

    // Init progress
    const initProg: Record<number, string> = {};
    annotatedIds.forEach((tid) => {
      initProg[tid] = uploadedHashes[tid] ? "done" : "pending";
    });
    setUploadProgress(initProg);
    setUploadCount(Object.keys(uploadedHashes).length);
    setStep("uploading");
    setError("");

    try {
      const uploads: { taskId: number; rootHash: string }[] = [];
      const currentUploaded = { ...uploadedHashes };

      for (let i = 0; i < annotatedIds.length; i++) {
        const tid = annotatedIds[i];

        if (currentUploaded[tid]) {
          // Already uploaded previously — reuse rootHash!
          uploads.push({ taskId: tid, rootHash: currentUploaded[tid] });
          setUploadProgress((p) => ({ ...p, [tid]: "done" }));
          continue;
        }

        setUploadProgress((p) => ({ ...p, [tid]: "uploading" }));
        try {
          const rootHash = await uploadJson({ jobId, taskId: tid, annotation: drafts[tid], timestamp: Date.now() });
          currentUploaded[tid] = rootHash;
          setUploadedHashes({ ...currentUploaded });
          uploads.push({ taskId: tid, rootHash });
          setUploadProgress((p) => ({ ...p, [tid]: "done" }));
          setUploadCount((c) => c + 1);
        } catch (err: any) {
          setUploadProgress((p) => ({ ...p, [tid]: "error" }));
          throw new Error(`Upload failed for Task #${tid + 1}: ${err.message}. Previously uploaded tasks are saved.`);
        }
      }

      setStep("submitting");
      const tids = uploads.map((u) => u.taskId);
      const hashes = uploads.map((u) => u.rootHash);
      const receipt = await marketV2.submitWorkBatch(jobId, tids, hashes);
      const lastTxHash = receipt.hash;

      // Clear all drafts & upload cache
      annotatedIds.forEach((tid) => {
        safeStorageRemove(`draft-${jobId}-${tid}`);
        safeStorageRemove(`draft-text-${jobId}-${tid}`);
      });
      setDraftAnnotations({});
      setUploadedHashes({});
      setTxHash(lastTxHash);
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
      <div className="page" style={{ maxWidth: 640, margin: "0 auto", paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,228,121,0.12)", border: "1px solid rgba(0,228,121,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--primary)" }}>check_circle</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Annotations Submitted!</h2>
          <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 28, maxWidth: 460, margin: "0 auto 28px" }}>
            Your annotations for Job #{jobId} have been uploaded to 0G Storage &amp; submitted onchain. The Moondream AI will score your IoU quality and automatically distribute rewards proportionally.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {txHash && (
              <a href={`${GALILEO.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                View Transaction ↗
              </a>
            )}
            <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
              My Dashboard
            </button>
            <button className="btn-primary" onClick={() => navigate("/jobs")}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>work</span>
              Browse Active Jobs
            </button>
          </div>
        </div>
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
          <button className="btn-ghost" onClick={() => navigate("/jobs")} title="Back to Active Jobs" style={{ padding: "4px 0" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          </button>
          <div className="divider-v" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Job #{jobId}: {isImage ? "Image" : "Text"} Annotation</div>
            <div className="label-caps">Task {taskId + 1}/{totalTasks}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {error && step === "error" && <span style={{ color: "var(--error)", fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{error}</span>}
          {annotatedCount > 0 && step === "idle" && (
            <button className="btn-primary" onClick={() => setShowPreview(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
              Submit All ({annotatedCount}) — 1 signature
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error states */}
      {!job && !error && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><p className="hint">Loading job…</p></div>}
      {job && !taskData && !error && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><p className="hint">Loading task data from 0G Storage…</p></div>}
      {error && !taskData && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 44, color: "var(--error)" }}>cloud_off</span>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Could Not Load 0G Storage Dataset</div>
          <p style={{ color: "var(--text-2)", fontSize: 13, maxWidth: 520, lineHeight: 1.5 }}>{error}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button className="btn-secondary" onClick={() => { setError(""); loadJob(); }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              Retry 0G Fetch
            </button>
            <button className="btn-ghost" onClick={() => navigate("/jobs")}>
              Back to Jobs
            </button>
          </div>
        </div>
      )}

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
                    const isDrafted     = draftAnnotations[i] !== undefined;
                    const isSubmitted   = userSubmittedTasks.has(i);
                    const isDone        = isDrafted || isSubmitted;
                    const isCurrent     = i === taskId;
                    const slotCount     = taskSubCounts[i] ?? 0;
                    const maxSlots      = Number(job?.maxAnnotatorsPerTask ?? job?.maxAnnotators ?? 5);
                    const isFull        = slotCount >= maxSlots;

                    return (
                      <div key={i}
                        onClick={() => goToTask(i)}
                        title={isSubmitted ? `Task ${i + 1}: Already submitted by your wallet` : isFull ? `Task ${i + 1}: Slots full (${slotCount}/${maxSlots} submitted)` : `Task ${i + 1}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                          borderRadius: 4,
                          cursor: isSubmitted || (isFull && !isDone) ? "not-allowed" : "pointer",
                          opacity: isSubmitted ? 0.65 : (isFull && !isDone ? 0.5 : 1),
                          background: isSubmitted ? "rgba(0,228,121,0.06)" : (isCurrent ? "var(--primary-bg)" : "transparent"),
                          border: isSubmitted ? "1px solid rgba(0,228,121,0.25)" : (isCurrent ? "1px solid rgba(0,228,121,0.3)" : "1px solid transparent"),
                        }}>
                        <span className="material-symbols-outlined" style={{
                          fontSize: 14,
                          color: isSubmitted || isDrafted ? "var(--primary)" : isFull ? "#ffd700" : "var(--text-3)",
                        }}>
                          {isSubmitted || isDrafted ? "check_circle" : isFull ? "group" : "radio_button_unchecked"}
                        </span>
                        <span style={{ fontSize: 12, color: isCurrent ? "var(--primary)" : isDone ? "var(--text)" : "var(--text-3)" }}>
                          Task {i + 1}
                        </span>

                        {/* Slot counter / Submitted pill */}
                        <span style={{
                          marginLeft: "auto", fontSize: 9, fontWeight: 700,
                          padding: "1px 5px", borderRadius: 3,
                          background: isSubmitted ? "rgba(0,228,121,0.15)" : (isFull ? "rgba(255,215,0,0.12)" : slotCount > 0 ? "rgba(0,228,121,0.1)" : "transparent"),
                          color: isSubmitted ? "var(--primary)" : (isFull ? "#ffd700" : slotCount > 0 ? "var(--primary)" : "var(--text-3)"),
                          border: isSubmitted ? "1px solid rgba(0,228,121,0.3)" : (isFull ? "1px solid rgba(255,215,0,0.3)" : slotCount > 0 ? "1px solid rgba(0,228,121,0.2)" : "none"),
                        }}>
                          {isSubmitted ? "DONE" : `${slotCount}/${maxSlots}`}
                        </span>
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
                userAlreadySubmitted={userSubmittedTasks.has(taskId)}
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

      {/* Upload Progress Modal */}
      {(step === "uploading" || step === "submitting" || step === "error") && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 32, width: 460, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--primary)", animation: "spin 1.5s linear infinite" }}>progress_activity</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                  {step === "uploading" ? "Uploading Annotations" : "Waiting for Signature"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  {step === "uploading"
                    ? `${uploadCount} of ${Object.keys(uploadProgress).length} files uploaded to 0G Storage`
                    : "Check MetaMask — sign the batch transaction"}
                </div>
              </div>
            </div>

            {/* Per-task upload list */}
            {step === "uploading" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, maxHeight: 260, overflowY: "auto" }}>
                {Object.entries(uploadProgress).map(([tid, status]) => (
                  <div key={tid} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 6,
                    background: status === "done" ? "rgba(0,228,121,0.06)" : status === "error" ? "rgba(255,68,68,0.08)" : "var(--surface-low)",
                    border: `1px solid ${status === "done" ? "rgba(0,228,121,0.2)" : status === "error" ? "rgba(255,68,68,0.25)" : "var(--border)"}`,
                  }}>
                    {status === "done" && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary)", flexShrink: 0 }}>check_circle</span>}
                    {status === "uploading" && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#60a5fa", flexShrink: 0, animation: "spin 1s linear infinite" }}>progress_activity</span>}
                    {status === "pending" && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-3)", flexShrink: 0 }}>radio_button_unchecked</span>}
                    {status === "error" && <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--error)", flexShrink: 0 }}>error</span>}
                    <span style={{ fontSize: 13, color: status === "done" ? "var(--text)" : status === "uploading" ? "#93c5fd" : "var(--text-3)" }}>
                      Task {Number(tid) + 1}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)", fontFamily: "'Space Grotesk', monospace" }}>
                      {status === "done" ? "Uploaded ✓" : status === "uploading" ? "Uploading…" : status === "error" ? "Failed" : "Waiting"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Sign tx step */}
            {step === "submitting" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px",
                background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 8, marginBottom: 20 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#60a5fa", animation: "pulse-fade 1.5s ease-in-out infinite" }}>account_balance_wallet</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>Open MetaMask</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>One signature submits all {uploadCount} annotations onchain</div>
                </div>
              </div>
            )}

            {/* Error & Retry State */}
            {step === "error" && (
              <div style={{ padding: 16, background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--error)", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
                  Upload Error
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16 }}>
                  {error}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary btn-sm" onClick={() => handleSubmitAll()} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                    Retry Failed Uploads
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => setStep("idle")}>
                    Cancel / Back to Workspace
                  </button>
                </div>
              </div>
            )}

            {/* Overall progress bar */}
            <div style={{ marginBottom: 8 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: step === "submitting" ? "100%" : `${uploadCount / Math.max(1, Object.keys(uploadProgress).length) * 100}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right", fontFamily: "'Space Grotesk', monospace" }}>
              {step === "submitting" ? "All files uploaded – awaiting signature" : `${uploadCount} / ${Object.keys(uploadProgress).length} uploaded`}
            </div>
          </div>
        </div>
      )}

      {/* Review & Preview modal */}
      {showPreview && step === "idle" && (
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
                onClick={() => handleSubmitAll()}
                disabled={annotatedCount === 0}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
                Submit {annotatedCount} Tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
