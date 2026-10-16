import type { StructureNode } from "../../types";
import type { TimelineRow } from "../timeline";
import { isScene, leafDepth, sorted, type Shape } from "./tree";

/** A column of the Outline's Cards: what holds the scenes, and the scenes in it. */
export interface CardColumn {
  key: string;
  /** The part the column is (a chapter); null when scenes sit at the top. */
  node: StructureNode | null;
  title: string;
  /** The part above it (its act), named over the first of its columns. */
  over?: string;
  scenes: StructureNode[];
}

/**
 * The Cards' columns, as the reader meets them (doc 29 D2): one per part just above the
 * scenes (a chapter in three acts, a section in Freeform), each named, with its act named over
 * the first of its columns. A shape whose scenes sit at the top has one column.
 */
export function cardColumns(tree: StructureNode[], shape: Shape): CardColumn[] {
  const leaf = leafDepth(shape);
  if (leaf === 0) {
    const scenes = sorted(tree).filter((n) => isScene(n, 0, shape));
    return [{ key: "top", node: null, title: shape.plurals[0] ?? "Scenes", scenes }];
  }
  const out: CardColumn[] = [];
  const walk = (list: StructureNode[], depth: number, top: StructureNode | null) => {
    let first = true;
    for (const node of sorted(list)) {
      if (depth === leaf - 1) {
        out.push({
          key: node.id,
          node,
          title: node.title || "Untitled",
          over: first && top && top.id !== node.id ? top.title : undefined,
          scenes: sorted(node.children).filter((n) => isScene(n, depth + 1, shape)),
        });
        first = false;
      } else if (depth < leaf - 1) walk(node.children ?? [], depth + 1, depth === 0 ? node : top);
    }
  };
  walk(tree, 0, null);
  return out;
}

/** A column of the Cards as it happens: an era's run of scenes, or the ones not placed yet. */
export interface TimeColumn {
  key: string;
  title: string;
  hint?: string;
  /** Placed in time: a card dropped here says when it happens. */
  placed: boolean;
  rows: TimelineRow[];
}

/** The placed scenes in runs by era (one run with no eras), then the ones not placed yet. */
export function timeColumns(placed: TimelineRow[], unplaced: TimelineRow[]): TimeColumn[] {
  const out: TimeColumn[] = [];
  for (const row of placed) {
    const last = out.at(-1);
    const era = row.era?.id ?? "";
    if (last && last.key.split(":")[1] === era) last.rows.push(row);
    else
      out.push({
        key: `${out.length}:${era}`,
        title: row.era?.name ?? "In the order it happens",
        placed: true,
        rows: [row],
      });
  }
  if (!out.length)
    out.push({
      key: "none",
      title: "In the order it happens",
      hint: "Nothing is placed in time yet. In the List, Place it next puts a scene here.",
      placed: true,
      rows: [],
    });
  if (unplaced.length)
    out.push({
      key: "unplaced",
      title: "Not on the timeline yet",
      hint: "In the order the reader meets them. Drop one on a card to say when it happens.",
      placed: false,
      rows: unplaced,
    });
  return out;
}
