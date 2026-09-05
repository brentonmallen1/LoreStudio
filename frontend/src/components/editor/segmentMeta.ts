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

/**
 * Count words after stripping dialogue speaker tags (e.g., <Maya>).
 * @mentions and [[settings]] ARE counted since they represent actual prose words.
 * Only the <Speaker> suffix is pure metadata and should be excluded.
 */
export function countWordsClean(text: string): number {
  const cleaned = text.replace(/<[^>]+>/g, "");
  const trimmed = cleaned.trim();
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
