export const WORD_COUNT_RANGES: Record<string, { min: number | null; max: number | null; label: string }> = {
  flash_fiction: { min: 0, max: 1_000, label: "Flash Fiction" },
  short_story: { min: 1_000, max: 7_500, label: "Short Story" },
  novelette: { min: 7_500, max: 17_500, label: "Novelette" },
  novella: { min: 17_500, max: 40_000, label: "Novella" },
  novel: { min: 40_000, max: 100_000, label: "Novel" },
  epic_saga: { min: 100_000, max: null, label: "Epic / Saga" },
  series: { min: null, max: null, label: "Series" },
};

/** Given the current word count, return the label of the form it falls into. */
export function detectForm(words: number): string | null {
  for (const [key, range] of Object.entries(WORD_COUNT_RANGES)) {
    if (key === "series") continue;
    const min = range.min ?? 0;
    const max = range.max ?? Infinity;
    if (words >= min && words < max) return range.label;
  }
  return null;
}

/** Return the next form up from the current intended_length. */
export function nextFormLabel(intendedLength: string): string | null {
  const keys = Object.keys(WORD_COUNT_RANGES);
  const idx = keys.indexOf(intendedLength);
  if (idx === -1 || idx >= keys.length - 1) return null;
  return WORD_COUNT_RANGES[keys[idx + 1]]?.label ?? null;
}
