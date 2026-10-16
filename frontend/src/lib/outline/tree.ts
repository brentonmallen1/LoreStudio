import type { StoryStructureTemplate, StructureNode } from "../../types";

/**
 * The Outline's tree operations (doc 29 D2), pure: what Tab, Shift+Tab and a drag do to the
 * acts, chapters and scenes, under the rules the shape (the structure template) sets.
 *
 * - Every level has its name: a row at depth d is the template's level d.
 * - Scenes are the deepest level and hold the prose; they hold no other part.
 * - Prose lives only in scenes (the acts-outline-import work): a row with words never becomes
 *   a part that holds others, and nothing is tucked under a row that has words of its own.
 *
 * Tab tucks a row into the row above it, one level deeper; the parts it held stay where they
 * were, under that row. Shift+Tab is its inverse: the row moves out a level, after its parent,
 * and holds the rows that came after it. So a planner types scenes, and Shift+Tab on a line
 * makes it the chapter that holds the scenes after it. A drag moves a row among rows of its own
 * level. Each returns the tree as it will be and the reorder operations that make it so, or why
 * not, in words for the writer.
 */

/** The id a new line wears until it is saved. */
export const DRAFT_ID = "__new_line__";

export interface Shape {
  /** The levels' names, top first: ["Act", "Chapter", "Scene"]. */
  names: string[];
  plurals: string[];
  /** Levels side by side at the top (Single MICE): no level holds another. */
  flat: boolean;
}

export function shapeOf(template: Pick<StoryStructureTemplate, "levels" | "flat"> | null | undefined): Shape {
  const levels = template?.levels?.length ? template.levels : [{ name: "Scene", plural: "Scenes" }];
  return {
    names: levels.map((l) => l.name),
    plurals: levels.map((l) => l.plural || `${l.name}s`),
    flat: !!template?.flat,
  };
}

/** The deepest level: where scenes are. */
export const leafDepth = (shape: Shape) => (shape.flat ? 0 : shape.names.length - 1);

/** A level's name at a depth, as `level_type` keeps it ("chapter"). */
export function levelType(shape: Shape, depth: number): string {
  return (shape.names[Math.min(depth, shape.names.length - 1)] ?? "scene").toLowerCase();
}

/** A level's name at a depth, as the writer reads it ("chapter", "chapters"). */
export function levelWord(shape: Shape, depth: number, plural = false): string {
  const at = Math.min(Math.max(depth, 0), shape.names.length - 1);
  return ((plural ? shape.plurals[at] : shape.names[at]) ?? (plural ? "scenes" : "scene")).toLowerCase();
}

export interface ReorderOp {
  node_id: string;
  parent_id: string | null;
  position: number;
  level_type?: string;
}

export type Move = { tree: StructureNode[]; ops: ReorderOp[] } | { refused: string };

export const sorted = (list: StructureNode[] | undefined) =>
  [...(list ?? [])].sort((a, b) => a.position - b.position);

/** Where a row is: its siblings in order, its place among them, its parent and its depth. */
export interface Place {
  node: StructureNode;
  siblings: StructureNode[];
  index: number;
  parent: StructureNode | null;
  depth: number;
}

export function placeOf(tree: StructureNode[], id: string): Place | null {
  const walk = (list: StructureNode[], parent: StructureNode | null, depth: number): Place | null => {
    const siblings = sorted(list);
    for (let index = 0; index < siblings.length; index++) {
      const node = siblings[index];
      if (node.id === id) return { node, siblings, index, parent, depth };
      const hit = walk(node.children ?? [], node, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(tree, null, 0);
}

/** A scene: a row with no parts in it at the deepest level, or one that holds words. */
export function isScene(node: StructureNode, depth: number, shape: Shape): boolean {
  return !node.children?.length && (depth >= leafDepth(shape) || node.word_count > 0);
}

/** Planned: a scene with no words yet (the dashed mark), whatever its status says. */
export const isPlanned = (node: StructureNode) => !node.word_count;

/** "The Gap", or "this line" for a row with no title yet. */
const named = (node: StructureNode) => (node.title.trim() ? `“${node.title.trim()}”` : "This line");

/** Tab: tuck the row into the one above it, a level deeper. */
export function indent(tree: StructureNode[], id: string, shape: Shape): Move {
  const at = placeOf(tree, id);
  if (!at) return { refused: "That line is gone." };
  if (shape.flat)
    return { refused: "This story's shape keeps its parts side by side, so nothing goes inside another." };
  const leaf = leafDepth(shape);
  if (at.depth >= leaf)
    return {
      refused: `A ${levelWord(shape, leaf)} is the smallest part, so it can't go inside another. Shift+Tab makes it a ${levelWord(shape, leaf - 1)}.`,
    };
  if (at.index === 0)
    return { refused: `There's nothing above ${named(at.node).toLowerCase()} to tuck it under.` };
  const above = at.siblings[at.index - 1];
  if (above.word_count > 0 && !above.children?.length)
    return { refused: `${named(above)} has words of its own, so it can't hold other parts.` };
  const depth = at.depth + 1;
  const moved = { ...at.node, level: depth, level_type: levelType(shape, depth), children: [] };
  // Its own parts stay at their level: under the row above, after it.
  const into = { ...above, children: [...sorted(above.children), moved, ...sorted(at.node.children)] };
  const siblings = at.siblings.filter((n) => n.id !== at.node.id).map((n) => (n.id === above.id ? into : n));
  const next = replaceChildren(tree, at.parent?.id ?? null, siblings);
  return { tree: renumber(next), ops: opsBetween(tree, renumber(next), new Set([at.node.id])) };
}

/** Shift+Tab: move the row out a level, after its parent, holding the rows after it. */
export function outdent(tree: StructureNode[], id: string, shape: Shape): Move {
  const at = placeOf(tree, id);
  if (!at) return { refused: "That line is gone." };
  if (shape.flat) return { refused: "This story's shape keeps its parts side by side." };
  if (!at.parent) return { refused: `${named(at.node)} is already at the top.` };
  if (at.node.word_count > 0)
    return {
      refused: `${named(at.node)} has words, so it stays a ${levelWord(shape, at.depth)}: your prose always lives in scenes.`,
    };
  if (at.node.children?.length)
    return {
      refused: `${named(at.node)} holds ${levelWord(shape, at.depth + 1, true)} of its own, so it can't move out a level. Drag it to move it whole.`,
    };
  const depth = at.depth - 1;
  const after = at.siblings.slice(at.index + 1);
  const moved = { ...at.node, level: depth, level_type: levelType(shape, depth), children: after };
  const parent = { ...at.parent, children: at.siblings.slice(0, at.index) };
  const grand = placeOf(tree, at.parent.id)!;
  const outer = [...grand.siblings];
  outer.splice(grand.index, 1, parent, moved);
  const next = renumber(replaceChildren(tree, grand.parent?.id ?? null, outer));
  return { tree: next, ops: opsBetween(tree, next, new Set([at.node.id])) };
}

/**
 * A drag: the row goes above or below another of its level, or into the end of a row one
 * level up. A drag never changes a row's level; Tab and Shift+Tab do.
 */
export function moveTo(
  tree: StructureNode[],
  id: string,
  targetId: string,
  zone: "above" | "below" | "into",
  shape: Shape,
): Move {
  if (id === targetId) return { refused: "" };
  const from = placeOf(tree, id);
  const target = placeOf(tree, targetId);
  if (!from || !target) return { refused: "That line is gone." };
  if (placeOf(from.node.children ?? [], targetId)) return { refused: "A part can't go inside itself." };
  const word = levelWord(shape, from.depth);
  if (zone === "into") {
    if (target.depth !== from.depth - 1)
      return { refused: `A ${word} goes inside a ${levelWord(shape, from.depth - 1)}.` };
    if (target.node.word_count > 0 && !target.node.children?.length)
      return { refused: `${named(target.node)} has words of its own, so it can't hold other parts.` };
  } else if (target.depth !== from.depth) {
    return {
      refused: `Drag a ${word} among ${levelWord(shape, from.depth, true)}; Tab and Shift+Tab move it a level.`,
    };
  }
  const without = removeNode(tree, id);
  const next = renumber(insertNode(without, from.node, targetId, zone));
  return { tree: next, ops: opsBetween(tree, next, new Set()) };
}

/** Every row's parent and place made true to the tree's order. */
export function renumber(list: StructureNode[], parentId: string | null = null): StructureNode[] {
  return list.map((n, i) => ({
    ...n,
    parent_id: parentId,
    position: i,
    children: renumber(n.children ?? [], n.id),
  }));
}

/** The reorder operations from one tree to the next: each row whose parent, place or level
 *  changed, parents before their parts (the server reads a parent's new level first). */
export function opsBetween(
  before: StructureNode[],
  after: StructureNode[],
  leveled: Set<string>,
): ReorderOp[] {
  const was = new Map<string, StructureNode>();
  const index = (list: StructureNode[]) =>
    list.forEach((n) => {
      was.set(n.id, n);
      index(n.children ?? []);
    });
  index(before);
  const ops: ReorderOp[] = [];
  const walk = (list: StructureNode[]) =>
    list.forEach((n) => {
      const old = was.get(n.id);
      const relevel = leveled.has(n.id);
      if (!old || old.parent_id !== n.parent_id || old.position !== n.position || relevel)
        ops.push({
          node_id: n.id,
          parent_id: n.parent_id,
          position: n.position,
          ...(relevel ? { level_type: n.level_type } : {}),
        });
      walk(n.children ?? []);
    });
  walk(after);
  return ops;
}

function replaceChildren(
  tree: StructureNode[],
  parentId: string | null,
  children: StructureNode[],
): StructureNode[] {
  if (parentId === null) return children;
  return tree.map((n) =>
    n.id === parentId
      ? { ...n, children }
      : { ...n, children: replaceChildren(n.children ?? [], parentId, children) },
  );
}

function removeNode(list: StructureNode[], id: string): StructureNode[] {
  return sorted(list)
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children ?? [], id) }));
}

function insertNode(
  list: StructureNode[],
  node: StructureNode,
  targetId: string,
  zone: "above" | "below" | "into",
): StructureNode[] {
  const at = list.findIndex((n) => n.id === targetId);
  if (at >= 0 && zone !== "into") {
    const copy = [...list];
    copy.splice(zone === "above" ? at : at + 1, 0, node);
    return copy;
  }
  return list.map((n) =>
    n.id === targetId && zone === "into"
      ? { ...n, children: [...sorted(n.children), node] }
      : { ...n, children: insertNode(sorted(n.children), node, targetId, zone) },
  );
}

/** The rows shown, top to bottom, with their depth: a folded row's parts are not. */
export interface Row {
  node: StructureNode;
  depth: number;
  scene: boolean;
}

export function visibleRows(tree: StructureNode[], folded: Set<string>, shape: Shape): Row[] {
  const out: Row[] = [];
  const walk = (list: StructureNode[], depth: number) =>
    sorted(list).forEach((node) => {
      out.push({ node, depth, scene: isScene(node, depth, shape) });
      if (!folded.has(node.id)) walk(node.children ?? [], depth + 1);
    });
  walk(tree, 0);
  return out;
}

/** What a part holds: "2 chapters · 3 scenes · 6,240 words". */
export function partSummary(node: StructureNode, depth: number, shape: Shape): string {
  const counts = new Map<number, number>();
  let words = 0;
  const walk = (list: StructureNode[], d: number) =>
    list.forEach((n) => {
      const scene = isScene(n, d, shape);
      const key = scene ? leafDepth(shape) : d;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (scene) words += n.word_count;
      walk(n.children ?? [], d + 1);
    });
  walk(node.children ?? [], depth + 1);
  const parts = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([d, n]) => `${n} ${levelWord(shape, d, n !== 1)}`);
  if (words) parts.push(`${words.toLocaleString()} ${words === 1 ? "word" : "words"}`);
  return parts.join(" · ");
}

/** Where a new line goes: a place under a parent, at a depth. */
export interface Spot {
  parentId: string | null;
  depth: number;
  position: number;
}

function childrenAt(tree: StructureNode[], parentId: string | null): StructureNode[] {
  return parentId === null ? sorted(tree) : sorted(placeOf(tree, parentId)?.node.children);
}

/** Enter on a row: an open part with parts in it gets a first one; anything else, the next. */
export function nextSpot(tree: StructureNode[], id: string, folded: Set<string>, shape: Shape): Spot | null {
  const at = placeOf(tree, id);
  if (!at) return null;
  if (at.node.children?.length && !folded.has(id) && !shape.flat)
    return { parentId: id, depth: at.depth + 1, position: 0 };
  return { parentId: at.parent?.id ?? null, depth: at.depth, position: at.index + 1 };
}

/** The row a new line shows under: its parent at the head of a list, else the last row shown
 *  of the sibling before it. Null is the very top. */
export function rowBefore(tree: StructureNode[], spot: Spot, folded: Set<string>): string | null {
  if (spot.position === 0) return spot.parentId;
  let n: StructureNode | undefined = childrenAt(tree, spot.parentId)[spot.position - 1];
  if (!n) return spot.parentId;
  while (n.children?.length && !folded.has(n.id)) n = sorted(n.children).at(-1)!;
  return n.id;
}

/** Tab on a new line not saved yet: into the end of the line above it, when that can hold it. */
export function indentSpot(tree: StructureNode[], spot: Spot, shape: Shape): Spot | { refused: string } {
  if (shape.flat) return { refused: "This story's shape keeps its parts side by side." };
  if (spot.depth >= leafDepth(shape))
    return {
      refused: `A ${levelWord(shape, spot.depth)} is the smallest part, so it can't go inside another.`,
    };
  const above = childrenAt(tree, spot.parentId)[spot.position - 1];
  if (!above) return { refused: "There's nothing above this line to tuck it under." };
  if (above.word_count > 0 && !above.children?.length)
    return { refused: `“${above.title}” has words of its own, so it can't hold other parts.` };
  return { parentId: above.id, depth: spot.depth + 1, position: above.children?.length ?? 0 };
}

/** Shift+Tab on a new line not saved yet: out after its parent, holding the lines after it. */
export function outdentSpot(
  tree: StructureNode[],
  spot: Spot,
  shape: Shape,
): { spot: Spot; adopt: string[] } | { refused: string } {
  if (shape.flat) return { refused: "This story's shape keeps its parts side by side." };
  if (spot.parentId === null) return { refused: "This line is already at the top." };
  const parent = placeOf(tree, spot.parentId)!;
  const adopt = childrenAt(tree, spot.parentId)
    .slice(spot.position)
    .map((n) => n.id);
  return {
    spot: { parentId: parent.parent?.id ?? null, depth: parent.depth, position: parent.index + 1 },
    adopt,
  };
}

/**
 * An Outline with nothing of the writer's in it yet: no words, no line of what happens, and at
 * most the one scene a new story starts with, still under its first name ("Scene 1"). It
 * shows the empty Outline for the way the writer works (doc 29 D2).
 */
export function isBlank(tree: StructureNode[], shape: Shape): boolean {
  let scenes = 0;
  let blank = true;
  const walk = (list: StructureNode[], depth: number) =>
    list.forEach((n) => {
      if (n.word_count || n.synopsis?.trim()) blank = false;
      if (isScene(n, depth, shape)) {
        scenes += 1;
        if (n.title.trim() && !/^\S+ \d+$/.test(n.title.trim())) blank = false;
      }
      walk(n.children ?? [], depth + 1);
    });
  walk(tree, 0);
  return blank && scenes <= 1;
}

/** The one scene of a blank Outline, to take its first line. */
export function firstScene(tree: StructureNode[], shape: Shape): StructureNode | null {
  for (const row of visibleRows(tree, new Set(), shape)) if (row.scene) return row.node;
  return null;
}

/** The page's summary line: "3 acts · 7 chapters · 18 scenes, 2 planned". */
export function outlineSummary(tree: StructureNode[], shape: Shape): string {
  const rows = visibleRows(tree, new Set(), shape);
  const leaf = leafDepth(shape);
  const parts = shape.names.slice(0, leaf).map((_, d) => {
    const n = rows.filter((r) => !r.scene && r.depth === d).length;
    return n ? `${n} ${levelWord(shape, d, n !== 1)}` : "";
  });
  const scenes = rows.filter((r) => r.scene);
  const planned = scenes.filter((r) => !r.node.word_count).length;
  const sceneLine = scenes.length
    ? `${scenes.length} ${levelWord(shape, leaf, scenes.length !== 1)}${planned ? `, ${planned} planned` : ""}`
    : "";
  return [...parts, sceneLine].filter(Boolean).join(" · ");
}
