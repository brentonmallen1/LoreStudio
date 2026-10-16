import type { StructureNode } from "../types";
import type { Beat, BeatSheet } from "../types/beats";

/**
 * Classic patterns (doc 29 D5): a beat sheet, by its one plain name. A pattern is a list of
 * moments many stories share and roughly where each falls; turned on, it tags the Outline.
 * The system ones are seeded on the server (`services/seed.py` `BEAT_SHEETS`) with their plain
 * names and lines; here is the name a writer may have met each by, for small print, and the
 * order the pickers list them in. A writer's own beat sheets follow them.
 */

export const PATTERN_KNOWN_AS: Record<string, string> = {
  "three-act-beats": "Known as three-act structure",
  "save-the-cat": "Known as Blake Snyder's Save the Cat beat sheet",
  "story-circle": "Known as Dan Harmon's story circle",
  "heros-journey": "Known as the hero's journey, after Campbell and Vogler",
};

/** Simplest first: the picker's order. */
export const PATTERN_ORDER = ["three-act-beats", "save-the-cat", "story-circle", "heros-journey"];

/** Sheets in the pickers' order: the system patterns as listed, then the writer's own by name. */
export function inPatternOrder<T extends { id: string; name: string }>(sheets: T[]): T[] {
  const rank = (s: T) => {
    const at = PATTERN_ORDER.indexOf(s.id);
    return at < 0 ? PATTERN_ORDER.length : at;
  };
  return [...sheets].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** A moment of a pattern, and the scenes of this story that carry it. */
export interface Moment {
  beat: Beat;
  /** In reading order, each with how far through the story it sits (0 to 100). */
  carriers: { node: StructureNode; at: number }[];
}

/**
 * Where the story stands against a pattern: each moment with the scenes that carry it (a
 * scene's `beat_id`), and how much of the story has words, as a share of its scenes.
 * `scenes` are the story's scenes in reading order (`sceneLeaves`).
 */
export function patternStanding(
  sheet: Pick<BeatSheet, "beats">,
  scenes: StructureNode[],
): { moments: Moment[]; written: number } {
  const at = (i: number) => (scenes.length ? ((i + 0.5) / scenes.length) * 100 : 0);
  const moments = [...sheet.beats]
    .sort((a, b) => a.position_pct - b.position_pct)
    .map((beat) => ({
      beat,
      carriers: scenes.flatMap((node, i) => (node.beat_id === beat.id ? [{ node, at: at(i) }] : [])),
    }));
  const written = scenes.length ? (scenes.filter((s) => s.word_count > 0).length / scenes.length) * 100 : 0;
  return { moments, written };
}

const WHERE: [number, string][] = [
  [0, "At the very start"],
  [10, "Near the start"],
  [25, "About a quarter of the way in"],
  [33, "About a third of the way in"],
  [50, "About halfway through"],
  [66, "About two thirds of the way in"],
  [75, "About three quarters of the way in"],
  [90, "Near the end"],
  [100, "At the very end"],
];

/** "About halfway through": where a moment tends to fall, in words. */
export function whereWords(pct: number): string {
  return WHERE.reduce((best, w) => (Math.abs(w[0] - pct) < Math.abs(best[0] - pct) ? w : best))[1];
}
