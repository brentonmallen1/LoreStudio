import type { StructureNode } from "../../types";
import { leafDepth, levelType, levelWord, placeOf, sorted, type Shape } from "./tree";

/**
 * Where an idea from the Not placed yet tray can become a planned scene (doc 29 D3): at the
 * start of a part that holds scenes, or after one of its scenes. The same spots serve the
 * keyboard's "Place it…" picker and a drag onto the List or the Cards.
 */
export interface PlaceSpot {
  key: string;
  parentId: string | null;
  /** Among the part's scenes, in order: the server makes room there. */
  position: number;
  depth: number;
  levelType: string;
  /** The part it goes in ("Chapter 3: Old Records"), a heading in the picker. */
  group: string;
  /** Where in it: "At the start", "After “The Gap”". */
  label: string;
}

const title = (node: StructureNode) => node.title.trim() || "Untitled";

/** Every part that holds scenes, in reading order, with its scenes. */
function holders(
  tree: StructureNode[],
  shape: Shape,
): { node: StructureNode | null; scenes: StructureNode[] }[] {
  const leaf = leafDepth(shape);
  if (leaf === 0) return [{ node: null, scenes: sorted(tree) }];
  const out: { node: StructureNode | null; scenes: StructureNode[] }[] = [];
  const walk = (list: StructureNode[], depth: number) => {
    for (const node of sorted(list)) {
      if (depth === leaf - 1) {
        if (!node.word_count || node.children?.length) out.push({ node, scenes: sorted(node.children) });
      } else if (depth < leaf - 1) walk(node.children ?? [], depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

/** The spots an idea can go, part by part. None when nothing holds scenes yet. */
export function placeSpots(tree: StructureNode[], shape: Shape): PlaceSpot[] {
  const depth = leafDepth(shape);
  const type = levelType(shape, depth);
  const scene = levelWord(shape, depth);
  return holders(tree, shape).flatMap(({ node, scenes }) => {
    const group = node ? title(node) : `The ${levelWord(shape, 0, true)}`;
    const base = { parentId: node?.id ?? null, depth, levelType: type, group };
    return [
      {
        ...base,
        key: `${node?.id ?? "top"}:0`,
        position: 0,
        label: scenes.length ? "At the start" : `As its first ${scene}`,
      },
      ...scenes.map((s, i) => ({
        ...base,
        key: `${node?.id ?? "top"}:${i + 1}`,
        position: i + 1,
        label: `After “${title(s)}”`,
      })),
    ];
  });
}

/**
 * Where an idea dropped on a row lands: above or below a scene, among its siblings, or at the
 * end of a part that holds scenes. Null where an idea cannot go (an act, the idea's own line).
 */
export function dropSpot(
  tree: StructureNode[],
  shape: Shape,
  targetId: string,
  zone: "above" | "below" | "into",
): PlaceSpot | null {
  const at = placeOf(tree, targetId);
  if (!at) return null;
  const leaf = leafDepth(shape);
  const type = levelType(shape, leaf);
  if (zone === "into") {
    const holds = at.depth === leaf - 1 && !(at.node.word_count && !at.node.children?.length);
    if (!holds) return null;
    const count = at.node.children?.length ?? 0;
    return {
      key: `${at.node.id}:${count}`,
      parentId: at.node.id,
      position: count,
      depth: leaf,
      levelType: type,
      group: title(at.node),
      label: "At the end",
    };
  }
  if (at.depth !== leaf || at.node.children?.length) return null;
  const position = at.index + (zone === "below" ? 1 : 0);
  return {
    key: `${at.parent?.id ?? "top"}:${position}`,
    parentId: at.parent?.id ?? null,
    position,
    depth: leaf,
    levelType: type,
    group: at.parent ? title(at.parent) : "",
    label: `${zone === "below" ? "After" : "Before"} “${title(at.node)}”`,
  };
}
