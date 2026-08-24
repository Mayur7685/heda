// DatasetHealthCard.tsx
// Computes and displays a dataset health report from annotation data.
// Runs entirely client-side from annotation JSON already in memory.
// Used in: Dashboard.tsx (after job complete, before publish)

import { useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type AnnotationBox = {
  type: "bbox";
  x: number; y: number; w: number; h: number;
  label: string;
};

type TaskAnnotation = AnnotationBox[] | { label: string } | null;

export interface HealthReport {
  score: number;          // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  totalTasks: number;
  annotatedTasks: number;
  totalAnnotations: number;
  classDistribution: Record<string, number>;
  imbalanceRatio: number;
  issues: {
    nullLabels: number;
    tinyBoxes: number;
    outOfBoundsBoxes: number;
    lowConfidenceCount: number; // for future use
  };
  warnings: Array<{ severity: "error" | "warning" | "info"; message: string }>;
  suggestions: string[];
}

// ── Health Computation ───────────────────────────────────────────────────────

export function computeHealth(
  annotations: Record<number, TaskAnnotation>,
  totalTasks: number,
  labels: string[]
): HealthReport {
  const annotatedTasks = Object.keys(annotations).length;
  const nullLabels = totalTasks - annotatedTasks;

  // Flatten all bbox annotations
  const allBoxes: AnnotationBox[] = [];
  const classDistribution: Record<string, number> = {};
  labels.forEach((l) => { classDistribution[l] = 0; });

  let totalAnnotations = 0;

  Object.values(annotations).forEach((ann) => {
    if (!ann) return;
    if (Array.isArray(ann)) {
      // Image annotations
      ann.forEach((box) => {
        if (box.type === "bbox") {
          allBoxes.push(box);
          totalAnnotations++;
          if (classDistribution[box.label] !== undefined) {
            classDistribution[box.label]++;
          } else {
            classDistribution[box.label] = 1;
          }
        }
      });
    } else {
      // Text annotation (single label)
      totalAnnotations++;
      const lbl = (ann as { label: string }).label;
      if (classDistribution[lbl] !== undefined) classDistribution[lbl]++;
      else classDistribution[lbl] = 1;
    }
  });

  // Canvas size reference (CANVAS_W from Workspace = 680, variable height)
  // Use a 1.0 normalized approach: boxes from workspace are in pixel space
  // Detect "tiny" as w or h < 15px (less than ~2% of 680px canvas)
  const tinyBoxes = allBoxes.filter((b) => b.w < 15 || b.h < 15).length;

  // Out-of-bounds: any coordinate < 0 (drag overshoot)
  const outOfBoundsBoxes = allBoxes.filter(
    (b) => b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0
  ).length;

  // Imbalance ratio
  const counts = Object.values(classDistribution).filter((v) => v > 0);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
  const minCount = counts.length > 0 ? Math.min(...counts) : 0;
  const imbalanceRatio = minCount > 0 ? maxCount / minCount : maxCount > 0 ? Infinity : 1;

  // Score calculation
  let score = 100;
  if (nullLabels > 0) score -= Math.min(30, nullLabels * 5);
  if (imbalanceRatio > 10) score -= 25;
  else if (imbalanceRatio > 5) score -= 15;
  else if (imbalanceRatio > 3) score -= 8;
  if (tinyBoxes > 5) score -= 10;
  if (outOfBoundsBoxes > 0) score -= 10;
  if (annotatedTasks === 0) score = 0;
  score = Math.max(0, Math.min(100, score));

  const grade: HealthReport["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  // Warnings
  const warnings: HealthReport["warnings"] = [];

  if (nullLabels > 0) {
    warnings.push({
      severity: "error",
      message: `${nullLabels} task${nullLabels > 1 ? "s" : ""} have no annotations — they will be skipped on submit`,
    });
  }
  if (imbalanceRatio > 5 && counts.length > 1) {
    const minClass = Object.entries(classDistribution).find(([, v]) => v === minCount)?.[0] ?? "";
    const maxClass = Object.entries(classDistribution).find(([, v]) => v === maxCount)?.[0] ?? "";
    warnings.push({
      severity: "warning",
      message: `Class imbalance: "${maxClass}" has ${isFinite(imbalanceRatio) ? Math.round(imbalanceRatio) + "×" : "∞"} more annotations than "${minClass}"`,
    });
  }
  if (tinyBoxes > 3) {
    warnings.push({
      severity: "warning",
      message: `${tinyBoxes} bounding boxes are very small (<15px) and may be annotation noise`,
    });
  }
  if (outOfBoundsBoxes > 0) {
    warnings.push({
      severity: "warning",
      message: `${outOfBoundsBoxes} box${outOfBoundsBoxes > 1 ? "es have" : " has"} negative coordinates and will be clipped`,
    });
  }
  if (score >= 90) {
    warnings.push({ severity: "info", message: "Dataset looks healthy! Good to publish." });
  }

  // Suggestions
  const suggestions: string[] = [];
  if (imbalanceRatio > 3 && counts.length > 1 && isFinite(imbalanceRatio)) {
    const minClass = Object.entries(classDistribution).find(([, v]) => v === minCount)?.[0] ?? "";
    const needed = maxCount - minCount;
    suggestions.push(`Add ~${needed} more annotations for class "${minClass}" to balance the dataset`);
  }
  if (nullLabels > 0) {
    suggestions.push("Complete or remove unannotated tasks before publishing");
  }
  if (tinyBoxes > 3) {
    suggestions.push("Review tiny boxes in the annotation editor — they may be accidental clicks");
  }

  return {
    score,
    grade,
    totalTasks,
    annotatedTasks,
    totalAnnotations,
    classDistribution,
    imbalanceRatio: isFinite(imbalanceRatio) ? Math.round(imbalanceRatio * 10) / 10 : 999,
    issues: { nullLabels, tinyBoxes, outOfBoundsBoxes, lowConfidenceCount: 0 },
    warnings,
    suggestions,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  A: "#00e479",
  B: "#7fff00",
  C: "#ffd700",
  D: "#ff9800",
  F: "#ff4444",
};

const SEV_COLOR = { error: "#ff4444", warning: "#ffd700", info: "#00bfff" };
const SEV_ICON = { error: "error", warning: "warning", info: "info" };

interface Props {
  annotations: Record<number, TaskAnnotation>;
  totalTasks: number;
  labels: string[];
  /** If provided, show a compact inline badge instead of full card */
  compact?: boolean;
}

export default function DatasetHealthCard({ annotations, totalTasks, labels, compact }: Props) {
  const report = useMemo(
    () => computeHealth(annotations, totalTasks, labels),
    [annotations, totalTasks, labels]
  );

  const gradeColor = GRADE_COLOR[report.grade] ?? "#00e479";
  const maxCount = Math.max(...Object.values(report.classDistribution), 1);

  // ── Compact badge (for sidebar / header use) ─────────────────────────────
  if (compact) {
    return (
      <div
        title={`Dataset Health: ${report.score}/100 (${report.grade})\n${report.warnings.map((w) => w.message).join("\n")}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 4,
          background: `${gradeColor}18`,
          border: `1px solid ${gradeColor}44`,
          cursor: "default",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: gradeColor, fontFamily: "'Space Grotesk', monospace" }}>
          {report.score}/100
        </span>
        <span
          style={{
            width: 16, height: 16, borderRadius: "50%",
            background: gradeColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 900, color: "#000",
          }}
        >
          {report.grade}
        </span>
        {report.issues.nullLabels > 0 && (
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#ff4444" }}>error</span>
        )}
      </div>
    );
  }

  // ── Full card ────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary)" }}>
            health_and_safety
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Dataset Health</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Score bar */}
          <div style={{ width: 100, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              width: `${report.score}%`, height: "100%",
              background: gradeColor, borderRadius: 3,
              transition: "width 0.4s ease",
            }} />
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, color: gradeColor,
            fontFamily: "'Space Grotesk', monospace",
          }}>
            {report.score}/100
          </span>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: gradeColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 900, color: "#000",
          }}>
            {report.grade}
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Quick stats */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Tasks", value: `${report.annotatedTasks}/${report.totalTasks}` },
            { label: "Annotations", value: report.totalAnnotations },
            { label: "Classes", value: labels.length },
            { label: "Imbalance", value: report.imbalanceRatio >= 99 ? "∞" : `${report.imbalanceRatio}×` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, background: "var(--surface-low)", borderRadius: 4,
              padding: "8px 10px", textAlign: "center",
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", fontFamily: "'Space Grotesk', monospace" }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {report.warnings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {report.warnings.map((w, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "8px 10px", borderRadius: 4,
                background: `${SEV_COLOR[w.severity]}12`,
                border: `1px solid ${SEV_COLOR[w.severity]}33`,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: SEV_COLOR[w.severity], flexShrink: 0, marginTop: 1 }}>
                  {SEV_ICON[w.severity]}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Class distribution */}
        {labels.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Class Distribution
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {labels.map((cls) => {
                const count = report.classDistribution[cls] ?? 0;
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const isMin = count > 0 && count === Math.min(...Object.values(report.classDistribution).filter(v => v > 0));
                return (
                  <div key={cls} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: isMin ? "#ffd700" : "var(--text-2)", width: 80, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cls}
                    </span>
                    <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%", borderRadius: 3,
                        background: isMin ? "#ffd700" : "var(--primary)",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: isMin ? "#ffd700" : "var(--text-2)",
                      fontFamily: "'Space Grotesk', monospace", width: 28, textAlign: "right", flexShrink: 0,
                    }}>
                      {count}
                    </span>
                    {isMin && count > 0 && (
                      <span style={{ fontSize: 10, color: "#ffd700", flexShrink: 0 }}>↓ low</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {report.suggestions.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Suggestions
            </div>
            {report.suggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--primary)", flexShrink: 0, marginTop: 1 }}>
                  lightbulb
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
