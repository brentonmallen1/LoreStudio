import { useMemo, useState, type ReactNode } from "react";
import type { CodexGraph } from "../../api/codex";
import { forceLayout, withinHops } from "../../lib/graph/forceLayout";
import { edgeLabel, isProposal, nodeColor, nodeLabel } from "../../lib/graph/codexVocabulary";
import styles from "./CodexGraphView.module.css";

const WIDTH = 900;
const HEIGHT = 460;
const RADIUS = 9;

interface Props {
  graph: CodexGraph;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  /** What the author can do about an empty graph — the page owns the build job. */
  emptyAction?: ReactNode;
}

/**
 * The graph, drawn (doc 07 §6).
 *
 * Two things it must get right. Suggested edges are dashed and stay dashed until the
 * author confirms them, so the picture never implies more certainty than the data has.
 * And the default view is the whole story with everything on — a filter you have to
 * discover is a filter that hides things from you.
 */
export default function CodexGraphView({ graph, selectedId, onSelect, emptyAction }: Props) {
  const kinds = useMemo(() => [...new Set(graph.nodes.map((n) => n.kind))].sort(), [graph.nodes]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState("");
  const [hops, setHops] = useState(1);

  const view = useMemo(() => {
    const visibleKinds = graph.nodes.filter((n) => !hidden.has(n.kind));
    const asLinks = graph.edges.map((e) => ({ source: e.src_id, target: e.dst_id }));
    const near = withinHops(
      focus,
      asLinks,
      hops,
      visibleKinds.map((n) => n.id),
    );
    const nodes = visibleKinds.filter((n) => near.has(n.id));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.src_id) && ids.has(e.dst_id));
    const positions = forceLayout(
      nodes.map((n) => ({ id: n.id, radius: RADIUS })),
      edges.map((e) => ({ source: e.src_id, target: e.dst_id })),
      WIDTH,
      HEIGHT,
    );
    return { nodes, edges, positions };
  }, [graph, hidden, focus, hops]);

  function toggleKind(kind: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  if (graph.nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No graph yet</p>
        <p>
          The graph is built from what you have already written: characters, locations, relationships and who
          appears in which scene. Nothing is invented and no AI is involved.
        </p>
        {emptyAction && <div className={styles.emptyAction}>{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <select
          className={styles.select}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          aria-label="Focus on"
        >
          <option value="">Whole story</option>
          {graph.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {nodeLabel(n.kind)}: {n.label}
            </option>
          ))}
        </select>
        {focus && (
          <select
            className={styles.select}
            value={hops}
            onChange={(e) => setHops(Number(e.target.value))}
            aria-label="How far"
          >
            <option value={1}>1 step away</option>
            <option value={2}>2 steps away</option>
            <option value={3}>3 steps away</option>
          </select>
        )}
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.kindToggle}
            data-on={!hidden.has(kind)}
            onClick={() => toggleKind(kind)}
          >
            <span className={styles.swatch} style={{ background: nodeColor(kind) }} />
            {nodeLabel(kind)}
          </button>
        ))}
      </div>

      <div className={styles.canvas}>
        <svg className={styles.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Codex graph">
          {view.edges.map((edge) => {
            const a = view.positions.get(edge.src_id);
            const b = view.positions.get(edge.dst_id);
            if (!a || !b) return null;
            return (
              <line
                key={edge.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={isProposal(edge.source) ? styles.edgeProposed : styles.edge}
              >
                <title>
                  {edgeLabel(edge.kind)}
                  {isProposal(edge.source) ? " (suggested — not confirmed)" : ""}
                </title>
              </line>
            );
          })}
          {view.nodes.map((node) => {
            const at = view.positions.get(node.id);
            if (!at) return null;
            const selected = node.id === selectedId;
            return (
              <g key={node.id} className={styles.node} onClick={() => onSelect(node.id)}>
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={selected ? RADIUS + 3 : RADIUS}
                  fill={nodeColor(node.kind)}
                  stroke={selected ? "var(--color-text)" : "var(--color-surface)"}
                  strokeWidth={selected ? 2 : 1.5}
                  opacity={isProposal(node.props.source as string) ? 0.6 : 1}
                >
                  <title>
                    {nodeLabel(node.kind)}: {node.label}
                  </title>
                </circle>
                <text x={at.x} y={at.y + RADIUS + 11} textAnchor="middle" className={styles.nodeLabel}>
                  {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          {view.nodes.length} of {graph.nodes.length} things · {view.edges.length} connections
        </span>
        {graph.edges.some((e) => isProposal(e.source)) && (
          <span className={styles.legendItem}>
            <span className={styles.legendDash} /> suggested, awaiting your answer
          </span>
        )}
      </div>
    </div>
  );
}
