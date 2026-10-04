/** One stretch of books that say the same thing about a field. */
export interface ProgressionStep {
  from: number;
  to: number;
  value: string;
  storyIds: string[];
}

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * A field book by book, as its changes (series doc): neighbouring books that say the same
 * thing are one step, so what the reader sees is where it changed, not the same paragraph
 * once per book.
 */
export function progressionSteps(
  values: { story_id: string; position: number; value: string }[],
): ProgressionStep[] {
  const out: ProgressionStep[] = [];
  for (const v of [...values].sort((a, b) => a.position - b.position)) {
    const last = out[out.length - 1];
    if (last && same(last.value, v.value)) {
      last.to = v.position;
      last.storyIds.push(v.story_id);
    } else out.push({ from: v.position, to: v.position, value: v.value, storyIds: [v.story_id] });
  }
  return out;
}

/** "Book 2", "Books 1–3", or "Books 1 and 2". */
export function stepLabel(step: Pick<ProgressionStep, "from" | "to">): string {
  if (step.from === step.to) return `Book ${step.from + 1}`;
  if (step.to === step.from + 1) return `Books ${step.from + 1} and ${step.to + 1}`;
  return `Books ${step.from + 1}–${step.to + 1}`;
}
