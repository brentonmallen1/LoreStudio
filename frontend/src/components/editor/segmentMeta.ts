import type { StructureNode } from "../../types";
import { readerText } from "../../lib/prose/syntax";

/**
 * Words in the prose as a reader sees it (lib/prose/syntax readerText): a speaker tag after
 * a line ("…"<Maya>) is metadata and not counted, a mention's words are, and any other "<"
 * is just a character ("x < 5"). The server counts the same way (services/word_count.py);
 * both run shared/prose-syntax/cases.json.
 */
export function countWordsClean(text: string): number {
  const trimmed = readerText(text).trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

// One icon and one colour per level type, shared with the outline tree and the strip.
export { getSegmentIcon, segmentColor } from "../layout/structureTreeMeta";

export const LINK_TYPES = [
  { value: "foreshadowing", forward: "Foreshadows →", reverse: "← Foreshadowed by" },
  { value: "callback", forward: "Calls back to →", reverse: "← Called back by" },
  { value: "causes", forward: "Causes →", reverse: "← Caused by" },
  { value: "parallel", forward: "Parallels →", reverse: "← Paralleled by" },
  { value: "contrast", forward: "Contrasts with →", reverse: "← Contrasted by" },
  { value: "echoes", forward: "Echoes →", reverse: "← Echoed by" },
];

export function flattenStructure(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

/** Clamp a popup so it stays inside the viewport. */
export function clampPopup(bottom: number, left: number, height: number, width: number) {
  return {
    top: Math.min(bottom + 4, window.innerHeight - height),
    left: Math.max(8, Math.min(left, window.innerWidth - width)),
  };
}
