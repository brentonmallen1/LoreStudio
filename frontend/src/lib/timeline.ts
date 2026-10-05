/**
 * The story in the order it happened (series v2): scenes placed on the timeline by the
 * author, each with its date and era, against the order the reader meets them. A scene the
 * reader meets out of order (a flashback, a frame) is marked. Pure, for the Timeline view.
 */
import type { Era, StructureNode } from "../types";

export interface TimelineRow {
  node: StructureNode;
  /** Its place in reading order, from 1. */
  readingRank: number;
  /** Placed on the timeline somewhere other than where the reader meets it. */
  outOfOrder: boolean;
  era: Era | null;
  /** The first row of a run in one era: where the era's band starts. */
  eraStarts: boolean;
}

/** Leaves of the tree in reading order. */
export function readingOrder(nodes: StructureNode[]): StructureNode[] {
  const out: StructureNode[] = [];
  const walk = (list: StructureNode[]) => {
    for (const n of [...list].sort((a, b) => a.position - b.position)) {
      if (n.children?.length) walk(n.children);
      else out.push(n);
    }
  };
  walk(nodes);
  return out;
}

/** The placed scenes in timeline order, then the ones not yet placed in reading order.
 * `leaves` are the book's scenes in reading order (the Plan's `sceneLeaves`). */
export function timelineRows(
  leaves: StructureNode[],
  eras: Era[],
): { placed: TimelineRow[]; unplaced: TimelineRow[] } {
  const rank = new Map(leaves.map((n, i) => [n.id, i + 1]));
  const eraById = new Map(eras.map((e) => [e.id, e]));
  const placedNodes = leaves
    .filter((n) => n.timeline_position != null)
    .sort((a, b) => a.timeline_position! - b.timeline_position! || rank.get(a.id)! - rank.get(b.id)!);
  const inOrder = longestInOrder(placedNodes.map((n) => rank.get(n.id)!));
  let lastEra: string | null | undefined;
  const placed = placedNodes.map((node, i): TimelineRow => {
    const era = (node.era_id && eraById.get(node.era_id)) || null;
    const eraStarts = !!era && era.id !== lastEra;
    lastEra = era?.id ?? null;
    return { node, readingRank: rank.get(node.id)!, outOfOrder: !inOrder.has(i), era, eraStarts };
  });
  const unplaced = leaves
    .filter((n) => n.timeline_position == null)
    .map((node) => ({
      node,
      readingRank: rank.get(node.id)!,
      outOfOrder: false,
      era: (node.era_id && eraById.get(node.era_id)) || null,
      eraStarts: false,
    }));
  return { placed, unplaced };
}

/**
 * Out of order is what breaks the longest run of scenes the reader meets in the order they
 * happen: one flashback is the flashback, not every scene after it. The indexes of that run.
 */
function longestInOrder(ranks: number[]): Set<number> {
  const best = ranks.map(() => 1);
  const prev = ranks.map(() => -1);
  for (let i = 0; i < ranks.length; i++)
    for (let j = 0; j < i; j++)
      if (ranks[j] < ranks[i] && best[j] + 1 > best[i]) {
        best[i] = best[j] + 1;
        prev[i] = j;
      }
  const out = new Set<number>();
  let at = best.indexOf(Math.max(0, ...best));
  while (at >= 0) {
    out.add(at);
    at = prev[at];
  }
  return out;
}

/** The timeline positions after moving the placed scene at `from` to `to`: ids → 1-based place. */
export function movedPositions(placed: StructureNode[], from: number, to: number): Map<string, number> {
  const next = [...placed];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return new Map(next.map((n, i) => [n.id, i + 1]));
}
