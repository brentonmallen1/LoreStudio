import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode, SceneLink } from "../../types";
import styles from "./SceneLinkGraph.module.css";

// ── Link type definitions ──────────────────────────────────────
const LINK_TYPES = [
  { value: "foreshadowing", label: "Foreshadowing", color: "#4a80b8", directional: true },
  { value: "callback", label: "Callback", color: "#4a9c5e", directional: true },
  { value: "causes", label: "Causes", color: "#c4791e", directional: true },
  { value: "parallel", label: "Parallel", color: "#8b6aa8", directional: false },
  { value: "contrast", label: "Contrast", color: "#b83232", directional: false },
  { value: "echoes", label: "Echoes", color: "#2a9d8f", directional: false },
] as const;

function getLinkColor(type: string): string {
  return LINK_TYPES.find((t) => t.value === type)?.color ?? "#888";
}
function isDirectional(type: string): boolean {
  return LINK_TYPES.find((t) => t.value === type)?.directional ?? true;
}

// ── Node appearance ────────────────────────────────────────────
const NODE_RADIUS = 18;
const STATUS_STROKE: Record<string, string> = {
  draft: "var(--color-border)",
  revised: "var(--color-warning)",
  final: "var(--color-accent)",
};
function nodeStroke(status: string): string {
  return STATUS_STROKE[status] ?? "var(--color-border)";
}

// ── Force simulation ───────────────────────────────────────────
interface SimNode extends SimulationNodeDatum {
  id: string;
  status: string;
}
interface SimEdge extends SimulationLinkDatum<SimNode> {
  source: string;
  target: string;
}

function simulate(
  nodes: { id: string; status: string }[],
  edges: { source: string; target: string }[],
  w: number,
  h: number,
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map();
  const n = nodes.length;
  const ns: SimNode[] = nodes.map((node, i) => ({
    ...node,
    x: w / 2 + Math.cos((2 * Math.PI * i) / n) * Math.min(w, h) * 0.3,
    y: h / 2 + Math.sin((2 * Math.PI * i) / n) * Math.min(w, h) * 0.3,
  }));
  forceSimulation<SimNode>(ns)
    .force("charge", forceManyBody<SimNode>().strength(-300))
    .force(
      "link",
      forceLink<SimNode, SimEdge>(edges as SimEdge[])
        .id((d) => d.id)
        .distance(160),
    )
    .force("center", forceCenter(w / 2, h / 2).strength(0.08))
    .force("collide", forceCollide<SimNode>().radius(NODE_RADIUS + 20))
    .stop()
    .tick(300);
  return new Map(ns.map((nd) => [nd.id, { x: nd.x ?? w / 2, y: nd.y ?? h / 2 }]));
}

// ── Bezier helpers ─────────────────────────────────────────────
function curveCP(x1: number, y1: number, x2: number, y2: number, bend = 30) {
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { cx: mx - (dy / len) * bend, cy: my + (dx / len) * bend };
}

// For directional edges: move endpoint back along ctrl→target direction by r+markerSize
function adjustedEnd(cx: number, cy: number, tx: number, ty: number, r: number) {
  const dx = tx - cx,
    dy = ty - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = r + 7; // node radius + arrow size
  return { x: tx - (dx / len) * offset, y: ty - (dy / len) * offset };
}

function trunc(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── Flatten leaf scenes ────────────────────────────────────────
function flattenLeaves(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    if (!n.children || n.children.length === 0) result.push(n);
    else n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

// ── Constants ──────────────────────────────────────────────────
const ZOOM_MIN = 0.2,
  ZOOM_MAX = 4;
const DEFAULT_XFORM = { scale: 1, tx: 0, ty: 0 };

// ── Component ─────────────────────────────────────────────────
export default function SceneLinkGraph() {
  const { structure, activeStory, setActiveNode } = useStoryStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [links, setLinks] = useState<SceneLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dims, setDims] = useState({ w: 700, h: 480 });
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [hovNode, setHovNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hovEdge, setHovEdge] = useState<string | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Viewport transform
  const [xform, setXform] = useState(DEFAULT_XFORM);
  const xformRef = useRef(DEFAULT_XFORM);
  useEffect(() => {
    xformRef.current = xform;
  }, [xform]);

  // Drag state
  const [drag, setDrag] = useState<{
    id: string;
    startSx: number;
    startSy: number;
    startWx: number;
    startWy: number;
    moved: boolean;
  } | null>(null);
  const [pan, setPan] = useState<{
    startSx: number;
    startSy: number;
    startTx: number;
    startTy: number;
  } | null>(null);

  // Container resize
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch links
  useEffect(() => {
    if (!activeStory) return;
    setLoading(true);
    api
      .getSceneLinks({ story_id: activeStory.id })
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeStory?.id]);

  // Flatten structure to leaf scenes (memoized for stable identity)
  const sceneNodes = useMemo(() => flattenLeaves(structure), [structure]);

  // Run simulation when scenes, links, or dims change
  useEffect(() => {
    if (sceneNodes.length === 0) return;
    const { w, h } = dims;
    const nodeInput = sceneNodes.map((n) => ({ id: n.id, status: n.status }));
    const edgeInput = links.map((l) => ({ source: l.source_node_id, target: l.target_node_id }));
    setPositions(simulate(nodeInput, edgeInput, w, h));
    setXform(DEFAULT_XFORM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneNodes.length, links.length, dims.w, dims.h]);

  // Zoom wheel
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { scale, tx, ty } = xformRef.current;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale * factor));
      const wx = (sx - tx) / scale;
      const wy = (sy - ty) / scale;
      setXform({ scale: newScale, tx: sx - wx * newScale, ty: sy - wy * newScale });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Mouse handlers ──────────────────────────────────────────
  function onNodeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const rect = svgRef.current!.getBoundingClientRect();
    const pos = positions.get(id);
    if (!pos) return;
    setDrag({
      id,
      startSx: e.clientX - rect.left,
      startSy: e.clientY - rect.top,
      startWx: pos.x,
      startWy: pos.y,
      moved: false,
    });
  }

  function onSvgMouseDown(e: React.MouseEvent) {
    if (drag) return;
    setPan({ startSx: e.clientX, startSy: e.clientY, startTx: xform.tx, startTy: xform.ty });
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setSelectedNode(null);
  }

  function onSvgMouseMove(e: React.MouseEvent) {
    if (drag) {
      const rect = svgRef.current!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = drag.startWx + (sx - drag.startSx) / xform.scale;
      const wy = drag.startWy + (sy - drag.startSy) / xform.scale;
      setDrag((d) => (d ? { ...d, moved: true } : d));
      setPositions((prev) => new Map([...prev, [drag.id, { x: wx, y: wy }]]));
    } else if (pan) {
      setXform({
        scale: xform.scale,
        tx: pan.startTx + (e.clientX - pan.startSx),
        ty: pan.startTy + (e.clientY - pan.startSy),
      });
    }
  }

  function onSvgMouseUp() {
    setDrag(null);
    setPan(null);
  }

  // ── Highlight state ─────────────────────────────────────────
  const activeNodeId = selectedNode ?? hovNode;
  const connectedLinks = activeNodeId
    ? links.filter((l) => l.source_node_id === activeNodeId || l.target_node_id === activeNodeId)
    : null;
  const connectedNodeIds = connectedLinks
    ? new Set(connectedLinks.flatMap((l) => [l.source_node_id, l.target_node_id]))
    : null;
  const connectedLinkIds = connectedLinks ? new Set(connectedLinks.map((l) => l.id)) : null;

  const activeLinkTypes = useMemo(() => new Set(links.map((l) => l.link_type)), [links]);

  const { w, h } = dims;
  const { scale, tx, ty } = xform;

  return (
    <div className={styles.container}>
      <div className={styles.svgWrap} ref={wrapRef}>
        {loading && <div className={styles.overlay}>Loading…</div>}
        {!loading && sceneNodes.length === 0 && <div className={styles.overlay}>No scenes yet.</div>}
        {!loading && sceneNodes.length > 0 && links.length === 0 && (
          <div className={styles.emptyHint}>
            No scene links yet. Add links via the Notes panel in any scene.
          </div>
        )}

        <svg
          ref={svgRef}
          width={w}
          height={h}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          onMouseLeave={onSvgMouseUp}
          style={{
            cursor: drag || pan ? "grabbing" : "grab",
            userSelect: "none",
            display: "block",
          }}
        >
          <defs>
            {LINK_TYPES.filter((t) => t.directional).map((t) => (
              <marker
                key={t.value}
                id={`slg-arrow-${t.value}`}
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M 0 0 L 0 6 L 7 3 z" fill={t.color} opacity={0.85} />
              </marker>
            ))}
          </defs>

          <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
            {/* ── Edges ── */}
            {links.map((link) => {
              const src = positions.get(link.source_node_id);
              const tgt = positions.get(link.target_node_id);
              if (!src || !tgt) return null;

              const color = getLinkColor(link.link_type);
              const dir = isDirectional(link.link_type);
              const isLit = !connectedLinkIds || connectedLinkIds.has(link.id);
              const isHov = hovEdge === link.id;

              const { cx, cy } = curveCP(src.x, src.y, tgt.x, tgt.y);
              const end = dir ? adjustedEnd(cx, cy, tgt.x, tgt.y, NODE_RADIUS) : { x: tgt.x, y: tgt.y };

              const midX = 0.25 * src.x + 0.5 * cx + 0.25 * end.x;
              const midY = 0.25 * src.y + 0.5 * cy + 0.25 * end.y;

              const typeInfo = LINK_TYPES.find((t) => t.value === link.link_type);
              const labelText = typeInfo?.label ?? link.link_type;
              const noteText = link.note ? `: ${trunc(link.note, 20)}` : "";
              const fullLabel = labelText + noteText;
              const labelW = Math.min(fullLabel.length * 5.8 + 12, 180);

              return (
                <g
                  key={link.id}
                  opacity={isLit ? 1 : 0.07}
                  style={{ transition: "opacity 120ms ease" }}
                  onMouseEnter={() => setHovEdge(link.id)}
                  onMouseLeave={() => setHovEdge(null)}
                >
                  {/* Fat invisible hit zone */}
                  <path
                    d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${end.x} ${end.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                  />
                  <path
                    d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${end.x} ${end.y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHov ? 2 : 1.5}
                    strokeOpacity={isHov ? 1 : 0.7}
                    markerEnd={dir ? `url(#slg-arrow-${link.link_type})` : undefined}
                    style={{ transition: "stroke-width 100ms ease, stroke-opacity 100ms ease" }}
                  />
                  {isHov && (
                    <g pointerEvents="none">
                      <rect
                        x={midX - labelW / 2}
                        y={midY - 18}
                        width={labelW}
                        height={13}
                        rx={3}
                        fill="var(--color-bg)"
                        opacity={0.93}
                      />
                      <text
                        x={midX}
                        y={midY - 8}
                        textAnchor="middle"
                        fontSize={9.5}
                        fill="var(--color-text-subtle)"
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {fullLabel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {sceneNodes.map((scene) => {
              const pos = positions.get(scene.id);
              if (!pos) return null;

              const isActive = activeNodeId === scene.id;
              const isDim = connectedNodeIds !== null && !connectedNodeIds.has(scene.id);
              const s = isActive ? 1.08 : 1;
              const stroke = nodeStroke(scene.status);

              return (
                <g
                  key={scene.id}
                  transform={`translate(${pos.x}, ${pos.y}) scale(${s})`}
                  style={{
                    transition: isActive ? "none" : "opacity 120ms ease",
                    cursor: drag?.id === scene.id ? "grabbing" : "grab",
                    opacity: isDim ? 0.22 : 1,
                  }}
                  onMouseEnter={() => !drag && setHovNode(scene.id)}
                  onMouseLeave={() => setHovNode(null)}
                  onMouseDown={(e) => onNodeMouseDown(e, scene.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (drag?.moved) return;
                    if (clickTimerRef.current) {
                      clearTimeout(clickTimerRef.current);
                      clickTimerRef.current = null;
                    }
                    clickTimerRef.current = setTimeout(() => {
                      setSelectedNode((prev) => (prev === scene.id ? null : scene.id));
                      clickTimerRef.current = null;
                    }, 220);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) {
                      clearTimeout(clickTimerRef.current);
                      clickTimerRef.current = null;
                    }
                    setActiveNode(scene);
                  }}
                >
                  {/* Selection / hover halo */}
                  {isActive && (
                    <circle
                      r={NODE_RADIUS + 7}
                      fill={stroke}
                      opacity={selectedNode === scene.id ? 0.18 : 0.11}
                    />
                  )}
                  <circle
                    r={NODE_RADIUS}
                    fill="var(--color-surface)"
                    stroke={stroke}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  {/* Scene title inside circle */}
                  <text
                    textAnchor="middle"
                    y={-1}
                    fontSize={8.5}
                    fontWeight={isActive ? 600 : 400}
                    fill={isActive ? "var(--color-text)" : "var(--color-text-muted)"}
                    fontFamily="Inter, system-ui, sans-serif"
                    pointerEvents="none"
                    style={{ transition: "fill 120ms ease" }}
                  >
                    {trunc(scene.title || "Untitled", 12)}
                  </text>
                  {/* Level type below title */}
                  <text
                    textAnchor="middle"
                    y={11}
                    fontSize={7.5}
                    fill="var(--color-text-subtle)"
                    fontFamily="Inter, system-ui, sans-serif"
                    pointerEvents="none"
                  >
                    {scene.level_type}
                  </text>
                  <title>
                    {scene.title} ({scene.level_type}) · {scene.status}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Reset view button */}
        {!loading && sceneNodes.length > 0 && (
          <button className={styles.resetBtn} onClick={() => setXform(DEFAULT_XFORM)} title="Reset view">
            <Crosshair size={13} />
          </button>
        )}

        {/* Zoom indicator */}
        {!loading && sceneNodes.length > 0 && Math.abs(scale - 1) > 0.05 && (
          <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
        )}

        {/* Double-click hint */}
        {!loading && sceneNodes.length > 0 && (
          <span className={styles.hint}>Double-click a scene to open it</span>
        )}
      </div>

      {/* ── Legend ── */}
      <div className={styles.legend}>
        {LINK_TYPES.filter((t) => activeLinkTypes.has(t.value)).map((t) => (
          <span key={t.value} className={styles.legendItem}>
            <span className={styles.legendLine} style={{ backgroundColor: t.color, opacity: 0.85 }} />
            {t.directional && <span className={styles.legendArrow} style={{ borderLeftColor: t.color }} />}
            <span>{t.label}</span>
          </span>
        ))}
        <span className={styles.legendStatus}>
          <span className={styles.statusDot} style={{ borderColor: "var(--color-border)" }} />
          draft
          <span className={styles.statusDot} style={{ borderColor: "var(--color-warning)" }} />
          revised
          <span className={styles.statusDot} style={{ borderColor: "var(--color-accent)" }} />
          final
        </span>
        <span className={styles.legendCount} style={{ marginLeft: "auto" }}>
          {sceneNodes.length} scene{sceneNodes.length !== 1 ? "s" : ""}
          {links.length > 0 ? ` · ${links.length} link${links.length !== 1 ? "s" : ""}` : ""}
        </span>
      </div>
    </div>
  );
}
