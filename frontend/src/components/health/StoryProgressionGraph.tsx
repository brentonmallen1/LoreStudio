import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { PacingEntry, PlotThread, BeatSheet } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./StoryProgressionGraph.module.css";

interface Props {
  pacing: PacingEntry[];
  threads: PlotThread[];
  beatSheet: BeatSheet | null;
  storyId: string;
}

type MetricTab = "words" | "status" | "threads";

const MARGIN = { top: 24, right: 12, bottom: 32, left: 44 };
const CHART_H = 160;
const STATUS_H = 48;
const THREAD_ROW_H = 26;
const MIN_SLOT_W = 4;

const STATUS_COLORS: Record<string, string> = {
  final: "#4caf82",
  revised: "var(--color-accent)",
  draft: "var(--color-text-muted)",
};

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? "var(--color-text-muted)";
}

interface Tooltip {
  sceneIdx: number;
  x: number;
  y: number;
}

export default function StoryProgressionGraph({ pacing, threads, beatSheet, storyId }: Props) {
  const navigate = useNavigate();
  const { structure, setActiveNode } = useStoryStore();
  const [tab, setTab] = useState<MetricTab>("words");
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setSvgWidth(w);
    });
    obs.observe(el);
    setSvgWidth(el.clientWidth || 600);
    return () => obs.disconnect();
  }, []);

  // Build flat node map for click-to-navigate
  const nodeMap = useCallback(() => {
    const map = new Map<string, import("../../types").StructureNode>();
    function walk(n: import("../../types").StructureNode) { map.set(n.id, n); n.children.forEach(walk); }
    structure.forEach(walk);
    return map;
  }, [structure])();

  const sceneCount = pacing.length;
  const innerW = svgWidth - MARGIN.left - MARGIN.right;
  const slotW = Math.max(MIN_SLOT_W, innerW / Math.max(sceneCount, 1));
  const maxWords = Math.max(...pacing.map((p) => p.word_count), 1);

  // Beat markers: map position_pct → scene index
  const beatMarkers = (beatSheet?.beats ?? []).map((beat) => {
    const idx = Math.round((beat.position_pct / 100) * (sceneCount - 1));
    return { beat, idx };
  });

  // Thread spans: min/max scene index where each thread appears
  const sceneIndexMap = new Map(pacing.map((p, i) => [p.id, i]));
  const threadSpans = threads.map((thread) => {
    const indices = thread.appearances
      .map((a) => sceneIndexMap.get(a.node_id))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);

    // Fall back to opens_at/closes_at if no tagged appearances
    let minIdx = indices[0] ?? null;
    let maxIdx = indices[indices.length - 1] ?? null;
    if (minIdx === null && thread.opens_at_node_id) {
      const i = sceneIndexMap.get(thread.opens_at_node_id);
      if (i !== undefined) minIdx = i;
    }
    if (maxIdx === null && thread.closes_at_node_id) {
      const i = sceneIndexMap.get(thread.closes_at_node_id);
      if (i !== undefined) maxIdx = i;
    }
    if (minIdx !== null && maxIdx === null) maxIdx = minIdx;

    return { thread, minIdx, maxIdx, activeSet: new Set(indices) };
  }).filter((s) => s.minIdx !== null);

  // Dynamic SVG height based on current tab
  const svgHeight = (() => {
    if (tab === "threads") return MARGIN.top + Math.max(threadSpans.length, 1) * THREAD_ROW_H + MARGIN.bottom;
    if (tab === "status") return MARGIN.top + STATUS_H + MARGIN.bottom;
    return MARGIN.top + CHART_H + MARGIN.bottom; // words
  })();

  function xForScene(i: number) {
    return MARGIN.left + i * slotW;
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const relX = e.clientX - rect.left - MARGIN.left;
    const idx = Math.floor(relX / slotW);
    if (idx >= 0 && idx < sceneCount) {
      setTooltip({ sceneIdx: idx, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setTooltip(null);
    }
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const relX = e.clientX - rect.left - MARGIN.left;
    const idx = Math.floor(relX / slotW);
    if (idx >= 0 && idx < sceneCount) {
      const scene = pacing[idx];
      const node = nodeMap.get(scene.id);
      if (node) {
        setActiveNode(node);
        navigate(`/stories/${storyId}/write`);
      }
    }
  }

  // Y-axis ticks for pacing
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    frac: f,
    label: Math.round(f * maxWords).toLocaleString(),
    y: MARGIN.top + CHART_H * (1 - f),
  }));

  const tooltipEntry = tooltip !== null ? pacing[tooltip.sceneIdx] : null;
  const tooltipThreads = tooltipEntry
    ? threads.filter((t) => t.appearances.some((a) => a.node_id === tooltipEntry.id))
    : [];
  const tooltipBeat = tooltipEntry?.beat_id
    ? beatSheet?.beats.find((b) => b.id === tooltipEntry.beat_id)
    : null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.tabBar}>
        {(["words", "status", "threads"] as MetricTab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => { setTab(t); setTooltip(null); }}
            type="button"
          >
            {t === "words" ? "Word Count" : t === "status" ? "Scene Status" : "Thread Activity"}
          </button>
        ))}
        <span className={styles.sceneCount}>{sceneCount} scene{sceneCount !== 1 ? "s" : ""}</span>
      </div>

      <svg
        className={styles.svg}
        width={svgWidth}
        height={svgHeight}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        {/* Beat markers — shown across all tabs */}
        {beatMarkers.map(({ beat, idx }) => {
          const x = xForScene(idx) + slotW / 2;
          return (
            <g key={beat.id}>
              <line
                x1={x} y1={MARGIN.top - 8}
                x2={x} y2={svgHeight - MARGIN.bottom}
                stroke="var(--color-accent)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <text
                x={x} y={MARGIN.top - 10}
                textAnchor="middle"
                fontSize={8}
                fill="var(--color-accent)"
                opacity={0.8}
              >
                {beat.position_pct}%
              </text>
            </g>
          );
        })}

        {/* ── WORD COUNT TAB ── */}
        {tab === "words" && (
          <>
            {/* Y-axis */}
            {yTicks.map(({ frac, label, y }) => frac > 0 && (
              <g key={frac}>
                <line x1={MARGIN.left - 4} y1={y} x2={svgWidth - MARGIN.right} y2={y}
                  stroke="var(--color-border)" strokeWidth={0.5} />
                <text x={MARGIN.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">
                  {label}
                </text>
              </g>
            ))}
            {/* Baseline */}
            <line
              x1={MARGIN.left} y1={MARGIN.top + CHART_H}
              x2={svgWidth - MARGIN.right} y2={MARGIN.top + CHART_H}
              stroke="var(--color-border)" strokeWidth={1}
            />
            {/* Bars */}
            {pacing.map((entry, i) => {
              const barH = maxWords > 0 ? (entry.word_count / maxWords) * CHART_H : 0;
              const x = xForScene(i);
              const color = statusColor(entry.status);
              const isHovered = tooltip?.sceneIdx === i;
              return (
                <rect
                  key={entry.id}
                  x={x + 1}
                  y={MARGIN.top + CHART_H - barH}
                  width={Math.max(slotW - 2, 1)}
                  height={Math.max(barH, 1)}
                  fill={color}
                  opacity={isHovered ? 1 : 0.65}
                />
              );
            })}
          </>
        )}

        {/* ── STATUS TAB ── */}
        {tab === "status" && (
          <>
            {pacing.map((entry, i) => {
              const x = xForScene(i);
              const isHovered = tooltip?.sceneIdx === i;
              return (
                <rect
                  key={entry.id}
                  x={x}
                  y={MARGIN.top}
                  width={Math.max(slotW - 1, 1)}
                  height={STATUS_H}
                  fill={statusColor(entry.status)}
                  opacity={isHovered ? 1 : 0.7}
                />
              );
            })}
            {/* Status legend labels on Y */}
            <text x={MARGIN.left - 6} y={MARGIN.top + STATUS_H / 2 + 4} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">
              status
            </text>
          </>
        )}

        {/* ── THREADS TAB ── */}
        {tab === "threads" && (
          <>
            {threadSpans.length === 0 ? (
              <text x={MARGIN.left + innerW / 2} y={MARGIN.top + 20} textAnchor="middle"
                fontSize={11} fill="var(--color-text-subtle)">
                No thread activity to display
              </text>
            ) : (
              threadSpans.map(({ thread, minIdx, maxIdx, activeSet }, row) => {
                const y = MARGIN.top + row * THREAD_ROW_H;
                const spanX = xForScene(minIdx!);
                const spanW = xForScene(maxIdx! + 1) - spanX;
                const color = thread.color || "var(--color-accent)";
                return (
                  <g key={thread.id}>
                    {/* Row background */}
                    <rect x={MARGIN.left} y={y + 2} width={innerW} height={THREAD_ROW_H - 4}
                      fill="var(--color-surface-raised)" opacity={0.4} rx={2} />
                    {/* Active span */}
                    <rect x={spanX} y={y + 4} width={Math.max(spanW, slotW)}
                      height={THREAD_ROW_H - 8} fill={color} opacity={0.5} rx={3} />
                    {/* Per-scene dots for tagged appearances */}
                    {Array.from(activeSet).map((idx) => (
                      <circle key={idx}
                        cx={xForScene(idx) + slotW / 2}
                        cy={y + THREAD_ROW_H / 2}
                        r={Math.min(slotW / 2 - 1, 4)}
                        fill={color} opacity={0.9}
                      />
                    ))}
                    {/* Thread name label */}
                    <text
                      x={MARGIN.left - 6}
                      y={y + THREAD_ROW_H / 2 + 4}
                      textAnchor="end"
                      fontSize={9}
                      fill="var(--color-text-muted)"
                    >
                      {thread.name.length > 14 ? thread.name.slice(0, 13) + "…" : thread.name}
                    </text>
                  </g>
                );
              })
            )}
          </>
        )}

        {/* Hover highlight column */}
        {tooltip !== null && (
          <rect
            x={xForScene(tooltip.sceneIdx)}
            y={MARGIN.top}
            width={slotW}
            height={svgHeight - MARGIN.top - MARGIN.bottom}
            fill="var(--color-text)"
            opacity={0.06}
            style={{ pointerEvents: "none" }}
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip !== null && tooltipEntry && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(tooltip.x + 12, svgWidth - 200),
            top: Math.max(tooltip.y - 80, 4),
          }}
        >
          <div className={styles.ttTitle}>{tooltipEntry.title}</div>
          <div className={styles.ttRow}>
            <span className={styles.ttDot} style={{ background: statusColor(tooltipEntry.status) }} />
            <span className={styles.ttStatus}>{tooltipEntry.status}</span>
            <span className={styles.ttWords}>{tooltipEntry.word_count.toLocaleString()} words</span>
          </div>
          {tooltipBeat && (
            <div className={styles.ttBeat}>Beat: {tooltipBeat.name}</div>
          )}
          {tooltipThreads.length > 0 && (
            <div className={styles.ttThreads}>
              {tooltipThreads.map((t) => (
                <span key={t.id} className={styles.ttThread}
                  style={{ borderColor: t.color || "var(--color-accent)" }}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div className={styles.ttHint}>Click to open scene</div>
        </div>
      )}

      {/* Bottom legend */}
      {tab !== "threads" && (
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: "var(--color-text-muted)", opacity: 0.65 }} /> Draft
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: "var(--color-accent)", opacity: 0.65 }} /> Revised
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: "#4caf82", opacity: 0.65 }} /> Final
          </span>
          {beatSheet && (
            <span className={styles.legendItem} style={{ marginLeft: "auto", color: "var(--color-accent)" }}>
              ╎ {beatSheet.name} beats
            </span>
          )}
        </div>
      )}
    </div>
  );
}
