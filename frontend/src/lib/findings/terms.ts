import type { TermId } from "../glossary";

/**
 * The glossary word in a finding's line (doc 30 D1), by the check that made it: the first
 * match of the phrase becomes a `Term`, so "Passive voice in 3 sentences" explains itself.
 * The lines come from the server (`services/findings/`); a line that changes and no longer
 * matches simply shows as text.
 */
export const FINDING_TERMS: Record<string, [TermId, RegExp]> = {
  passive_voice: ["passive-voice", /passive voice/i],
  adverb_overuse: ["adverb", /adverbs?/i],
  said_bookisms: ["said-bookism", /dialogue tags? other than said/i],
  pov_drift: ["pov-slip", /point of view slips/i],
  tense_shift: ["tense-slip", /slips out of .+? tense/i],
  past_in_action: ["tense-slip", /slips into the past tense/i],
  mice_nesting: ["mice", /\bMICE\b/],
  thin_try_fail: ["try-fail", /try\/fail cycle/i],
};

/** A finding's line split around its glossary word: before, the word, after. */
export function findingTerm(
  check: string,
  text: string,
): { id: TermId; parts: [string, string, string] } | null {
  const hit = FINDING_TERMS[check];
  if (!hit) return null;
  const m = hit[1].exec(text);
  if (!m) return null;
  return {
    id: hit[0],
    parts: [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)],
  };
}
