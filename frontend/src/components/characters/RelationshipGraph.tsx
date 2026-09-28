import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, Eye, EyeOff } from "lucide-react";
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
import type { CharacterRelationship } from "../../types";
import styles from "./RelationshipGraph.module.css";

// ── Relationship type → edge color ─────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  family: "#6b8e6b",
  romantic: "#c97878",
  ally: "#7898c9",
  rival: "#c9a060",
  enemy: "#c96060",
  mentor: "#9878c9",
  confidant: "#78a878",
  authority: "#a8a060",
  foil: "#c9c060",
  protector: "#609878",
  "former ally": "#9890a0",
};

function edgeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? "#999";
}

function avgStrength(rel: CharacterRelationship): number {
  if (!rel.strength) return 5;
  return (rel.strength.trust + rel.strength.power + rel.strength.affection) / 3;
}

// ── Node sizing by role ─────────────────────────────────────────
const ROLE_RADIUS: Record<string, number> = {
  protagonist: 24,
  antagonist: 20,
  deuteragonist: 18,
  love_interest: 17,
  confidant: 16,
  foil: 16,
  supporting: 16,
  minor: 12,
  tertiary: 12,
};
function nodeRadius(role: string): number {
  return ROLE_RADIUS[role] ?? 14;
}

const ROLE_STROKE: Record<string, string> = {
  protagonist: "var(--color-accent)",
  antagonist: "var(--color-danger)",
  deuteragonist: "color-mix(in srgb, var(--color-accent) 55%, transparent)",
  love_interest: "color-mix(in srgb, var(--color-danger) 50%, var(--color-accent))",
  confidant: "var(--color-text-muted)",
  foil: "var(--color-warning, #c9a227)",
  supporting: "var(--color-text-muted)",
  minor: "var(--color-border)",
  tertiary: "var(--color-border-subtle)",
};
function nodeStroke(role: string): string {
  return ROLE_STROKE[role] ?? "var(--color-border)";
}

// ── D3 force simulation ─────────────────────────────────────────
interface SimNode extends SimulationNodeDatum {
  id: string;
  role: string;
}
interface SimEdge extends SimulationLinkDatum<SimNode> {
  source: string;
  target: string;
}

function simulate(
  nodes: { id: string; role: string }[],
  edges: { source: string; target: string }[],
  w: number,
  h: number,
) {
  if (nodes.length === 0) return new Map<string, { x: number; y: number }>();

  const n = nodes.length;
  const ns: SimNode[] = nodes.map((node, i) => ({
    ...node,
    x: w / 2 + Math.cos((2 * Math.PI * i) / n) * Math.min(w, h) * 0.3,
    y: h / 2 + Math.sin((2 * Math.PI * i) / n) * Math.min(w, h) * 0.3,
  }));

  const simulation = forceSimulation<SimNode>(ns)
    // Spaced for the names under each node, not just the circles: at -350 / 150 / +14 the
    // Lighthouse's four characters sat on each other's labels.
    .force("charge", forceManyBody<SimNode>().strength(-700))
    .force(
      "link",
      forceLink<SimNode, SimEdge>(edges as SimEdge[])
        .id((d) => d.id)
        .distance(210),
    )
    .force("center", forceCenter(w / 2, h / 2).strength(0.08))
    .force(
      "collide",
      forceCollide<SimNode>().radius((d) => nodeRadius(d.role) + 48),
    )
    .stop();

  simulation.tick(300);
  return new Map(ns.map((n) => [n.id, { x: n.x ?? w / 2, y: n.y ?? h / 2 }]));
}

function curveCP(x1: number, y1: number, x2: number, y2: number, bend = 28) {
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  const dx = x2 - x1,
    dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { cx: mx - (dy / len) * bend, cy: my + (dx / len) * bend };
}

function trunc(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const ZOOM_MIN = 0.2,
  ZOOM_MAX = 4;
const DEFAULT_XFORM = { scale: 1, tx: 0, ty: 0 };

interface EdgeTooltip {
  rel: CharacterRelationship;
  x: number;
  y: number;
}

interface Props {
  storyId: string;
  onEditRelationship?: (rel: CharacterRelationship) => void;
}

export default function RelationshipGraph({ storyId, onEditRelationship }: Props) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { characters } = useStoryStore();

  const [rels, setRels] = useState<CharacterRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [dims, setDims] = useState({ w: 700, h: 480 });
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [hovNode, setHovNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hovEdgeId, setHovEdgeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<EdgeTooltip | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [minStrength, setMinStrength] = useState(0);
  const [showHidden, setShowHidden] = useState(false);

  const [xform, setXform] = useState(DEFAULT_XFORM);
  const xformRef = useRef(DEFAULT_XFORM);
  useEffect(() => {
    xformRef.current = xform;
  }, [xform]);

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

  useEffect(() => {
    api
      .listStoryRelationships(storyId)
      .then(setRels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => {
    if (characters.length === 0) return;
    const { w, h } = dims;
    const nodeInput = characters.map((c) => ({ id: c.id, role: c.role }));
    const edgeSet = new Map<string, { source: string; target: string }>();
    for (const r of rels) {
      const key = [r.character_id, r.related_character_id].sort().join("|");
      if (!edgeSet.has(key)) edgeSet.set(key, { source: r.character_id, target: r.related_character_id });
    }
    setPositions(simulate(nodeInput, Array.from(edgeSet.values()), w, h));
    setXform(DEFAULT_XFORM);
  }, [characters, rels, dims]);

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
    setTooltip(null);
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

  // Apply filters
  const edgeMap = new Map<string, CharacterRelationship>();
  for (const r of rels) {
    const key = [r.character_id, r.related_character_id].sort().join("|");
    if (!edgeMap.has(key)) edgeMap.set(key, r);
  }
  const allEdges = Array.from(edgeMap.values());
  const edges = allEdges.filter((r) => {
    if (!showHidden && r.visibility === "hidden") return false;
    if (typeFilter !== "all" && r.relationship_type.toLowerCase() !== typeFilter) return false;
    if (avgStrength(r) < minStrength) return false;
    return true;
  });

  // Unique types present in all edges for the filter dropdown
  const presentTypes = Array.from(new Set(allEdges.map((r) => r.relationship_type.toLowerCase())));

  const activeNode = selectedNode ?? hovNode;
  const hovConnected = activeNode
    ? new Set(
        edges
          .filter((e) => e.character_id === activeNode || e.related_character_id === activeNode)
          .flatMap((e) => [e.character_id, e.related_character_id]),
      )
    : null;

  const { w, h } = dims;
  const { scale, tx, ty } = xform;

  return (
    <div className={styles.container}>
      {/* ── Filter bar ── */}
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All types</option>
          {presentTypes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <div className={styles.filterSlider}>
          <span className={styles.filterLabel}>Min strength</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={minStrength}
            className={styles.slider}
            onChange={(e) => setMinStrength(Number(e.target.value))}
          />
          <span className={styles.filterValue}>{minStrength}</span>
        </div>

        <button
          className={`${styles.filterToggle} ${showHidden ? styles.filterToggleActive : ""}`}
          onClick={() => setShowHidden((v) => !v)}
          title="Relationships marked 'hidden' (not visible to other story characters) — toggling this shows or hides them on the graph"
        >
          {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
          {showHidden ? "Showing hidden" : "Show hidden"}
        </button>

        <span className={styles.filterCount}>
          {edges.length} relationship{edges.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className={styles.svgWrap} ref={wrapRef}>
        {loading && <div className={styles.overlay}>Loading…</div>}
        {!loading && characters.length === 0 && <div className={styles.overlay}>No characters yet.</div>}

        <svg
          ref={svgRef}
          width={w}
          height={h}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          onMouseLeave={onSvgMouseUp}
          style={{
            cursor: drag ? "grabbing" : pan ? "grabbing" : "grab",
            userSelect: "none",
            display: "block",
          }}
        >
          <defs>
            {/* Arrowhead markers per color — generate for each present type */}
            {presentTypes.map((t) => {
              const color = edgeColor(t);
              return (
                <marker
                  key={t}
                  id={`arrow-${t.replace(/\s+/g, "-")}`}
                  viewBox="0 0 8 8"
                  refX="8"
                  refY="4"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill={color} />
                </marker>
              );
            })}
            <marker
              id="arrow-dim"
              viewBox="0 0 8 8"
              refX="8"
              refY="4"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-border)" />
            </marker>
          </defs>

          <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
            {/* ── Edges ── */}
            {edges.map((rel) => {
              const src = positions.get(rel.character_id);
              const tgt = positions.get(rel.related_character_id);
              if (!src || !tgt) return null;

              const isLit =
                activeNode === null ||
                rel.character_id === activeNode ||
                rel.related_character_id === activeNode;
              const showLabel = isLit && activeNode !== null;
              const isHovered = hovEdgeId === rel.id;
              const { cx, cy } = curveCP(src.x, src.y, tgt.x, tgt.y);
              const midX = 0.25 * src.x + 0.5 * cx + 0.25 * tgt.x;
              const midY = 0.25 * src.y + 0.5 * cy + 0.25 * tgt.y;
              const labelText = trunc(rel.relationship_type, 18);
              const labelW = labelText.length * 5.5 + 10;

              const tgtChar = characters.find((c) => c.id === rel.related_character_id);
              const tgtR = nodeRadius(tgtChar?.role ?? "minor") + 2;
              const edgeDx = tgt.x - cx,
                edgeDy = tgt.y - cy;
              const edgeDlen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
              const adjTx = tgt.x - (edgeDx / edgeDlen) * tgtR;
              const adjTy = tgt.y - (edgeDy / edgeDlen) * tgtR;

              const strength = avgStrength(rel);
              const strokeW = isHovered ? (1 + strength * 0.35) * 1.6 : 1 + strength * 0.35;
              const color = isLit ? edgeColor(rel.relationship_type) : "var(--color-border)";
              const typeKey = rel.relationship_type.toLowerCase().replace(/\s+/g, "-");
              const markerEnd = isLit ? `url(#arrow-${typeKey})` : "url(#arrow-dim)";
              const dashArray = rel.visibility === "hidden" ? "6,4" : undefined;

              return (
                <g
                  key={rel.id}
                  opacity={isLit ? 1 : 0.08}
                  style={{ transition: "opacity 120ms ease", cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setHovEdgeId(rel.id);
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) setTooltip({ rel, x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={() => {
                    setHovEdgeId(null);
                    setTooltip(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditRelationship?.(rel);
                  }}
                >
                  {/* Fat invisible hit area */}
                  <path
                    d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${adjTx} ${adjTy}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                  />
                  <path
                    d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${adjTx} ${adjTy}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeDasharray={dashArray}
                    markerEnd={markerEnd}
                    style={{ transition: "stroke 120ms ease, stroke-width 120ms ease" }}
                  />
                  {(showLabel || isHovered) && (
                    <g pointerEvents="none">
                      <rect
                        x={midX - labelW / 2}
                        y={midY - 17}
                        width={labelW}
                        height={13}
                        rx={3}
                        fill="var(--color-bg)"
                        opacity={0.92}
                      />
                      <text
                        x={midX}
                        y={midY - 7}
                        textAnchor="middle"
                        fontSize={9.5}
                        fill={color}
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {labelText}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {characters.map((char) => {
              const pos = positions.get(char.id);
              if (!pos) return null;
              const r = nodeRadius(char.role);
              const isActive = activeNode === char.id;
              const isDim = activeNode !== null && !hovConnected?.has(char.id);
              const s = isActive ? 1.08 : 1;

              return (
                <g
                  key={char.id}
                  transform={`translate(${pos.x}, ${pos.y}) scale(${s})`}
                  style={{
                    transition: isActive ? "none" : "opacity 120ms ease",
                    cursor: drag?.id === char.id ? "grabbing" : "grab",
                    opacity: isDim ? 0.22 : 1,
                  }}
                  onMouseEnter={() => !drag && setHovNode(char.id)}
                  onMouseLeave={() => setHovNode(null)}
                  onMouseDown={(e) => onNodeMouseDown(e, char.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (drag?.moved) return;
                    if (clickTimerRef.current) {
                      clearTimeout(clickTimerRef.current);
                      clickTimerRef.current = null;
                    }
                    clickTimerRef.current = setTimeout(() => {
                      setSelectedNode((prev) => (prev === char.id ? null : char.id));
                      clickTimerRef.current = null;
                    }, 220);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) {
                      clearTimeout(clickTimerRef.current);
                      clickTimerRef.current = null;
                    }
                    navigate(`/stories/${storyId}/characters/${char.id}`);
                  }}
                >
                  {isActive && (
                    <circle
                      r={r + 9}
                      fill={nodeStroke(char.role)}
                      opacity={selectedNode === char.id ? 0.18 : 0.11}
                    />
                  )}
                  <circle
                    r={r}
                    fill="var(--color-surface)"
                    stroke={nodeStroke(char.role)}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={r * 0.72}
                    fontWeight={500}
                    fill={isActive ? nodeStroke(char.role) : "var(--color-text-muted)"}
                    fontFamily="Inter, system-ui, sans-serif"
                    pointerEvents="none"
                    style={{ transition: "fill 120ms ease" }}
                  >
                    {char.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </text>
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isActive ? 500 : 400}
                    fill={isActive ? "var(--color-text)" : "var(--color-text-muted)"}
                    fontFamily="Inter, system-ui, sans-serif"
                    pointerEvents="none"
                    style={{ transition: "fill 120ms ease" }}
                  >
                    {trunc(char.name, 20)}
                  </text>
                  <title>
                    {char.name} — {char.role}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Edge tooltip */}
        {tooltip && (
          <div
            className={styles.edgeTooltip}
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
            onMouseEnter={() => {}}
          >
            <div className={styles.tooltipType} style={{ color: edgeColor(tooltip.rel.relationship_type) }}>
              {tooltip.rel.relationship_type}
              {tooltip.rel.visibility === "hidden" && <span className={styles.tooltipHidden}>· hidden</span>}
            </div>
            {tooltip.rel.strength && (
              <div className={styles.tooltipStrengths}>
                <span>
                  Trust <strong>{tooltip.rel.strength.trust}</strong>
                </span>
                <span>
                  Power <strong>{tooltip.rel.strength.power}</strong>
                </span>
                <span>
                  Affection <strong>{tooltip.rel.strength.affection}</strong>
                </span>
              </div>
            )}
            {tooltip.rel.narrative_purpose?.length > 0 && (
              <div className={styles.tooltipPurposes}>
                {tooltip.rel.narrative_purpose.slice(0, 3).map((p) => (
                  <span key={p} className={styles.tooltipPurposeTag}>
                    {p}
                  </span>
                ))}
              </div>
            )}
            {tooltip.rel.notes && <p className={styles.tooltipNotes}>{trunc(tooltip.rel.notes, 80)}</p>}
            {onEditRelationship && <p className={styles.tooltipClick}>Click to edit</p>}
          </div>
        )}

        {!loading && characters.length > 0 && (
          <button className={styles.resetBtn} onClick={() => setXform(DEFAULT_XFORM)} title="Reset view">
            <Crosshair size={13} />
          </button>
        )}
        {!loading && characters.length > 0 && Math.abs(scale - 1) > 0.05 && (
          <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
        )}
      </div>

      {/* ── Legend ── */}
      <div className={styles.legend}>
        {/* Node role legend */}
        {(["protagonist", "antagonist", "supporting", "minor"] as const)
          .filter((role) => characters.some((c) => c.role === role))
          .map((role) => (
            <span key={role} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{
                  width: nodeRadius(role) * 1.1,
                  height: nodeRadius(role) * 1.1,
                  borderColor: nodeStroke(role),
                  background: "var(--color-surface)",
                }}
              />
              {role}
            </span>
          ))}

        {/* Divider */}
        {edges.length > 0 && <span className={styles.legendDivider} />}

        {/* Edge type legend */}
        {Array.from(new Set(edges.map((r) => r.relationship_type.toLowerCase()))).map((type) => (
          <span key={type} className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: edgeColor(type) }} />
            {type}
          </span>
        ))}

        {/* Strength scale */}
        {edges.length > 0 && (
          <span className={styles.legendItem} style={{ marginLeft: "auto", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.65rem" }}>weak</span>
            <span className={styles.strengthScaleBar} />
            <span style={{ fontSize: "0.65rem" }}>strong</span>
          </span>
        )}
      </div>
    </div>
  );
}
