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
