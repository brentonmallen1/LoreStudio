import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

/**
 * Positions for a small graph, settled before it is drawn.
 *
 * The simulation runs to completion in one go rather than animating: a knowledge graph is
 * read, not played with, and a layout that drifts under the cursor makes it harder to
 * follow an edge from one node to another. Same approach as the relationship graph.
 */

export interface LayoutNode {
  id: string;
  /** Drawn radius, so collision keeps labels from overlapping. */
  radius?: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum, LayoutNode {}
type SimEdge = SimulationLinkDatum<SimNode>;

const DEFAULT_RADIUS = 14;
const TICKS = 300;

export function forceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  width: number,
  height: number,
  options: { linkDistance?: number; charge?: number } = {},
): Map<string, Point> {
  if (nodes.length === 0) return new Map();

  // Start on a ring rather than at the origin: from a single point the first ticks are
  // dominated by nodes shoving each other apart, and the result keeps its knots.
  const ring = Math.min(width, height) * 0.32;
  const sim: SimNode[] = nodes.map((node, i) => ({
    ...node,
    x: width / 2 + Math.cos((2 * Math.PI * i) / nodes.length) * ring,
    y: height / 2 + Math.sin((2 * Math.PI * i) / nodes.length) * ring,
  }));

  const known = new Set(nodes.map((n) => n.id));
  const links = edges.filter((e) => known.has(e.source) && known.has(e.target));

  forceSimulation<SimNode>(sim)
    .force("charge", forceManyBody<SimNode>().strength(options.charge ?? -320))
    .force(
      "link",
      forceLink<SimNode, SimEdge>(links.map((e) => ({ ...e })))
        .id((d) => d.id)
        .distance(options.linkDistance ?? 120),
    )
    .force("center", forceCenter(width / 2, height / 2).strength(0.08))
    // A node with no links has nothing holding it but the centre; without these it drifts
    // out of the frame and the drawing shrinks to fit it (doc 13 P7).
    .force("x", forceX<SimNode>(width / 2).strength(0.05))
    .force("y", forceY<SimNode>(height / 2).strength(0.09))
    .force(
      "collide",
      forceCollide<SimNode>().radius((d) => (d.radius ?? DEFAULT_RADIUS) + 12),
    )
    .stop()
    .tick(TICKS);

  // Kept inside the frame with room for the label under each dot.
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return new Map(
    sim.map((n) => [
      n.id,
      { x: clamp(n.x ?? width / 2, 70, width - 70), y: clamp(n.y ?? height / 2, 18, height - 28) },
    ]),
  );
}

/**
 * Node ids within `hops` edges of `focus`, following edges in either direction.
 *
 * Undirected on purpose: from a scene you want the characters in it, and from a character
 * you want the scenes they were in, and those are the same edge.
 */
export function withinHops(focus: string, edges: LayoutEdge[], hops: number, allIds: string[]): Set<string> {
  if (!focus) return new Set(allIds);
  const reached = new Set([focus]);
  let frontier = new Set([focus]);
  for (let i = 0; i < hops; i++) {
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.source) && !reached.has(edge.target)) next.add(edge.target);
      if (frontier.has(edge.target) && !reached.has(edge.source)) next.add(edge.source);
    }
    if (next.size === 0) break;
    next.forEach((id) => reached.add(id));
    frontier = next;
  }
  return reached;
}
