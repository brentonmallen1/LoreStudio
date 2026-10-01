import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { slotVar } from "../../lib/colorSlots";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { PlotThread, StructureNode } from "../../types";
import styles from "./ThreadVisualization.module.css";

// ── Layout constants ──────────────────────────────────────────
const LABEL_W = 148; // left column for thread names
const COL_W = 84; // width per scene column
const HDR_LVL = 30; // height per ancestor header level
const LEAF_HDR = 34; // height of leaf-label row
const ROW_H = 42; // height per thread row
const DOT_R = 3.5; // dot radius (normal)
const DOT_R_HOV = 5.5; // dot radius (hovered thread)
const PAD_T = 18;
const PAD_B = 20;

// ── Helpers ───────────────────────────────────────────────────
interface FlatNode {
  node: StructureNode;
  ancestors: StructureNode[];
}

function flattenLeaves(nodes: StructureNode[], ancestors: StructureNode[] = []): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    if (!n.children || n.children.length === 0) {
      out.push({ node: n, ancestors });
    } else {
      out.push(...flattenLeaves(n.children, [...ancestors, n]));
    }
  }
  return out;
}

interface Span {
  id: string;
  title: string;
  start: number;
  end: number;
}

function buildSpans(flatNodes: FlatNode[], level: number): Span[] {
  const spans: Span[] = [];
  let cur: Span | null = null;
  flatNodes.forEach((fn, i) => {
    const anc = fn.ancestors[level];
    if (!anc) {
      if (cur) {
        spans.push(cur);
        cur = null;
      }
      return;
    }
    if (!cur || cur.id !== anc.id) {
      if (cur) spans.push(cur);
      cur = { id: anc.id, title: anc.title, start: i, end: i };
    } else {
      cur.end = i;
    }
  });
  if (cur) spans.push(cur);
  return spans;
}

function trunc(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── Component ─────────────────────────────────────────────────
interface Props {
  storyId: string;
}

export default function ThreadVisualization({ storyId }: Props) {
  const navigate = useNavigate();
  const { setActiveNode } = useStoryStore();

  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovThread, setHovThread] = useState<string | null>(null);
  const [hovCol, setHovCol] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { structure } = useStoryStore();

  useEffect(() => {
    api
      .listThreads(storyId)
      .then((t) => setThreads(t))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  useReloadOnUndo(["plot_thread", "plot_thread_appearance", "structure_node"], () =>
    api.listThreads(storyId).then(setThreads),
  );

  if (loading) return <div className={styles.loading}>Loading…</div>;

  const flat = flattenLeaves(structure);

  if (flat.length === 0) {
    return (
      <div className={styles.empty}>Add some story structure to see the thread weave visualization.</div>
    );
  }

  // Map node_id → column index (direct leaf match)
  const leafColMap = new Map(flat.map((fn, i) => [fn.node.id, i]));

  // For a thread appearance, resolve which column(s) it maps to
  function appearanceCols(thread: PlotThread): number[] {
    const cols = new Set<number>();
    for (const app of thread.appearances) {
      const direct = leafColMap.get(app.node_id);
      if (direct !== undefined) {
        cols.add(direct);
      } else {
        // Appearance on a parent node — show on all its leaf descendants
        flat.forEach((fn, i) => {
          if (fn.ancestors.some((a) => a.id === app.node_id)) cols.add(i);
        });
      }
    }
    return Array.from(cols).sort((a, b) => a - b);
  }

  // Header spans by ancestor level
  const maxDepth = flat.reduce((m, fn) => Math.max(m, fn.ancestors.length), 0);
  const spansByLevel = Array.from({ length: maxDepth }, (_, lvl) => buildSpans(flat, lvl));

  const visibleThreads = threads.filter((t) => !hidden.has(t.id));

  // ── Dimensions ────────────────────────────────────────────
  const hdrH = PAD_T + maxDepth * HDR_LVL + LEAF_HDR;
  const bodyH = visibleThreads.length * ROW_H;
  const svgH = hdrH + bodyH + PAD_B;
  const svgW = Math.max(LABEL_W + flat.length * COL_W, 420);

  // Center x of column i
  const cx = (i: number) => LABEL_W + i * COL_W + COL_W / 2;
  // Center y of thread row idx
  const ry = (i: number) => hdrH + i * ROW_H + ROW_H / 2;

  function goToNode(fn: FlatNode) {
    setActiveNode(fn.node);
    navigate(`/stories/${storyId}/write/${fn.node.id}`);
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <svg width={svgW} height={svgH} className={styles.svg}>
          {/* ── Ancestor level spans ── */}
          {spansByLevel.map((spans, lvl) => {
            const y = PAD_T + lvl * HDR_LVL;
            return (
              <g key={`lvl-${lvl}`}>
                {spans.map((span) => {
                  const x1 = LABEL_W + span.start * COL_W;
                  const x2 = LABEL_W + (span.end + 1) * COL_W;
                  const midX = x1 + (x2 - x1) / 2;
                  return (
                    <g key={span.id}>
                      {/* Left tick for this span */}
                      <line
                        x1={x1 + 5}
                        y1={y + 22}
                        x2={x2 - 5}
                        y2={y + 22}
                        stroke="var(--color-border)"
                        strokeWidth={1}
                      />
                      <text
                        x={midX}
                        y={y + 14}
                        textAnchor="middle"
                        fontSize={lvl === 0 ? 11 : 10}
                        fontWeight={lvl === 0 ? 500 : 400}
                        fill="var(--color-text-muted)"
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {trunc(span.title, maxDepth <= 1 ? 18 : 14)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* ── Leaf node column labels ── */}
          {flat.map((fn, i) => {
            const isHov = hovCol === i;
            const colLeft = LABEL_W + i * COL_W;
            const labelY = PAD_T + maxDepth * HDR_LVL + 4;
            return (
              <g key={fn.node.id}>
                {/* Column highlight */}
                {isHov && (
                  <rect
                    x={colLeft + 2}
                    y={PAD_T}
                    width={COL_W - 4}
                    height={svgH - PAD_T - PAD_B}
                    fill="var(--color-surface-2)"
                    rx={4}
                    opacity={0.55}
                    pointerEvents="none"
                  />
                )}
                {/* Faint vertical dotted separator */}
                <line
                  x1={colLeft}
                  y1={PAD_T + maxDepth * HDR_LVL}
                  x2={colLeft}
                  y2={svgH - PAD_B}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  opacity={0.4}
                />
                <text
                  x={cx(i)}
                  y={labelY + 16}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill={isHov ? "var(--color-text)" : "var(--color-text-subtle)"}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ cursor: "pointer" }}
                >
                  <title>{fn.node.title}</title>
                  {trunc(fn.node.title, 10)}
                </text>
              </g>
            );
          })}

          {/* ── Header / body separator ── */}
          <line x1={LABEL_W} y1={hdrH} x2={svgW} y2={hdrH} stroke="var(--color-border)" strokeWidth={1} />

          {/* ── Thread rows ── */}
          {visibleThreads.map((thread, idx) => {
            const y = ry(idx);
            const cols = appearanceCols(thread);
            const isHov = hovThread === thread.id;
            const lineAlpha = hovThread === null ? 0.55 : isHov ? 1 : 0.12;
            const dotAlpha = hovThread === null ? 0.8 : isHov ? 1 : 0.12;
            const r = isHov ? DOT_R_HOV : DOT_R;

            return (
              <g key={thread.id}>
                {/* Row separator */}
                {idx > 0 && (
                  <line
                    x1={0}
                    y1={y - ROW_H / 2}
                    x2={svgW}
                    y2={y - ROW_H / 2}
                    stroke="var(--color-border)"
                    strokeWidth={0.5}
                    opacity={0.3}
                  />
                )}

                {/* Thread name */}
                <text
                  x={LABEL_W - 14}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={isHov ? slotVar(thread.color_slot) : "var(--color-text-muted)"}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ cursor: "default", userSelect: "none" }}
                  onMouseEnter={() => setHovThread(thread.id)}
                  onMouseLeave={() => setHovThread(null)}
                >
                  {trunc(thread.name, 18)}
                </text>

                {/* Label column separator */}
                <line
                  x1={LABEL_W - 6}
                  y1={y - ROW_H / 2 + 8}
                  x2={LABEL_W - 6}
                  y2={y + ROW_H / 2 - 8}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                  opacity={0.35}
                />

                {/* Connecting line: first → last appearance */}
                {cols.length >= 2 && (
                  <line
                    x1={cx(cols[0])}
                    y1={y}
                    x2={cx(cols[cols.length - 1])}
                    y2={y}
                    stroke={slotVar(thread.color_slot)}
                    strokeWidth={1.5}
                    opacity={lineAlpha}
                    style={{ transition: "opacity 120ms ease" }}
                    pointerEvents="none"
                  />
                )}

                {/* Glow halo (hovered thread only) */}
                {isHov &&
                  cols.map((col) => (
                    <circle
                      key={`halo-${col}`}
                      cx={cx(col)}
                      cy={y}
                      r={DOT_R_HOV + 5}
                      fill={slotVar(thread.color_slot)}
                      opacity={0.14}
                      pointerEvents="none"
                    />
                  ))}

                {/* Appearance dots */}
                {cols.map((col) => (
                  <circle
                    key={col}
                    cx={cx(col)}
                    cy={y}
                    r={r}
                    fill={slotVar(thread.color_slot)}
                    opacity={dotAlpha}
                    style={{ cursor: "pointer", transition: "opacity 120ms ease" }}
                    onMouseEnter={() => {
                      setHovThread(thread.id);
                      setHovCol(col);
                    }}
                    onMouseLeave={() => {
                      setHovThread(null);
                      setHovCol(null);
                    }}
                    onClick={() => goToNode(flat[col])}
                  >
                    <title>
                      {thread.name} — {flat[col].node.title}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* ── Invisible hover capture rects for columns ── */}
          {flat.map((fn, i) => (
            <rect
              key={`cap-${fn.node.id}`}
              x={LABEL_W + i * COL_W}
              y={hdrH}
              width={COL_W}
              height={bodyH}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovCol(i)}
              onMouseLeave={() => setHovCol(null)}
              onClick={() => goToNode(fn)}
            >
              <title>{fn.node.title}</title>
            </rect>
          ))}
        </svg>
      </div>

      {/* ── Thread legend ── */}
      {threads.length > 0 && (
        <div className={styles.legend}>
          {threads.map((t) => {
            const isHidden = hidden.has(t.id);
            return (
              <button
                key={t.id}
                className={`${styles.legendItem} ${isHidden ? styles.legendHidden : ""}`}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(t.id)) next.delete(t.id);
                    else next.add(t.id);
                    return next;
                  })
                }
              >
                <span
                  className={styles.legendDot}
                  style={{ background: isHidden ? "var(--color-border)" : slotVar(t.color_slot) }}
                />
                {t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
