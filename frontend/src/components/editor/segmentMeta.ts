import {
  BookMarked,
  Clapperboard,
  Flag,
  Layers,
  Milestone,
  Puzzle,
  Zap,
  type LucideIcon,
} from "lucide-react";
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

const SEGMENT_ICONS: Record<string, LucideIcon> = {
  act: Flag,
  chapter: BookMarked,
  scene: Clapperboard,
  section: Layers,
  beat: Zap,
  part: Puzzle,
  stage: Milestone,
};

export function getSegmentIcon(levelType: string): LucideIcon {
  return SEGMENT_ICONS[levelType.toLowerCase()] ?? Layers;
}

export function segmentColor(levelType: string): string {
  const key = levelType.toLowerCase();
  const known = ["act", "chapter", "scene", "section", "beat", "part", "stage"];
  return known.includes(key) ? `var(--segment-${key})` : "var(--color-accent)";
}

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
