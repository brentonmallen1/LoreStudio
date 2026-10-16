/**
 * Copy kept as data (a Plan step's "how", a finding's line) marks a glossary word as
 * `{{term:logline}}`, or `{{term:mice|MICE}}` when the words shown differ from the id.
 * `TermText` draws the marks as `Term`s; `plainTerms` gives the words alone, for a tooltip or
 * an aria-label, where a popover cannot go.
 */
const MARK = /\{\{term:([a-z0-9-]+)(?:\|([^}]+))?\}\}/g;

export type TermPart = string | { id: string; text: string };

/** The id read as words: "point-of-view" is "point of view". */
function shown(id: string, text?: string): string {
  return text ?? id.replace(/-/g, " ");
}

export function parseTerms(text: string): TermPart[] {
  const out: TermPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ id: m[1], text: shown(m[1], m[2]) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function plainTerms(text: string): string {
  return text.replace(MARK, (_whole, id: string, words?: string) => shown(id, words));
}

/** The ids a text marks, for the curated-words test. */
export function markedTerms(text: string): string[] {
  return [...text.matchAll(MARK)].map((m) => m[1]);
}
