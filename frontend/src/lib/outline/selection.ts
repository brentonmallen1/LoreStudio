import type { StructureNode } from "../../types";
import { DRAFT_ID, leafDepth, levelWord, placeOf, sorted, type Row, type Shape } from "./tree";

/**
 * Choosing scenes in the Outline List to wrap in a chapter (doc 29 D6): Shift+click a scene, or
 * Shift+↑ ↓ from a row, chooses the scenes between it and where the choice began. Pure, so the
 * rules the server keeps are said here first, in the writer's words.
 */

/** How to choose scenes, said wherever the way to wrap them is offered. */
export const CHOOSE_HINT =
  "Shift-click scenes in the Outline, or press Shift+↓ on a line, to choose them; then Wrap in a chapter.";

/** The scenes between two rows, inclusive, in the order the List shows them. */
export function scenesBetween(rows: Row[], from: string, to: string): string[] {
  const a = rows.findIndex((r) => r.node.id === from);
  const b = rows.findIndex((r) => r.node.id === to);
  if (a < 0 || b < 0) return [];
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return rows
    .slice(lo, hi + 1)
    .filter((r) => r.scene && r.node.id !== DRAFT_ID)
    .map((r) => r.node.id);
}

export type WrapCheck =
  /** `middle`: scenes from neither end of their part, which leaves it in three. */
  | { ok: true; level: string; parent: StructureNode | null; count: number; middle: boolean }
  | { ok: false; refused: string };

/**
 * Whether scenes can be wrapped in a part of their own: the shape has a level above scenes, the
 * scenes share a part, sit next to each other, and are not the whole of it.
 */
export function canWrap(tree: StructureNode[], ids: string[], shape: Shape): WrapCheck {
  const leaf = leafDepth(shape);
  if (shape.flat || leaf < 1)
    return {
      ok: false,
      refused: "This story's shape keeps its scenes side by side, with no level above them to wrap them in.",
    };
  const level = levelWord(shape, leaf - 1);
  const places = ids.map((id) => placeOf(tree, id));
  if (!places.length || places.some((p) => !p)) return { ok: false, refused: "Choose some scenes first." };
  const at = places as NonNullable<(typeof places)[number]>[];
  if (at.some((p) => p.node.children?.length))
    return { ok: false, refused: "Only scenes can be wrapped; one of those holds other parts." };
  const parent = at[0].parent;
  if (at.some((p) => p.parent?.id !== parent?.id))
    return { ok: false, refused: `Choose scenes from one ${level}: they are wrapped where they stand.` };
  const index = at.map((p) => p.index).sort((x, y) => x - y);
  if (index.some((i, k) => k > 0 && i !== index[k - 1] + 1))
    return { ok: false, refused: "Choose scenes that sit next to each other, so the order stays as it is." };
  const total = sorted(parent ? parent.children : tree).length;
  if (parent && index.length === total)
    return { ok: false, refused: `Those are every scene in “${parent.title || "Untitled"}” already.` };
  const middle = !!parent && index[0] > 0 && index[index.length - 1] < total - 1;
  return { ok: true, level, parent, count: index.length, middle };
}

/** A new part's name to start from: "Chapter 4", one more than the story has at that level. */
export function nextPartName(tree: StructureNode[], shape: Shape): string {
  const depth = leafDepth(shape) - 1;
  let count = 0;
  const walk = (list: StructureNode[], d: number) => {
    for (const n of list) {
      if (d === depth) count++;
      else if (d < depth) walk(n.children ?? [], d + 1);
    }
  };
  walk(tree, 0);
  const name = shape.names[Math.max(0, depth)] ?? "Part";
  return `${name} ${count + 1}`;
}
