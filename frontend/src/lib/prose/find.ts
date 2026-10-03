import { findMentions, findSpeakerTags, isWordChar, makeLexicon } from "./syntax";

/**
 * Find in a scene (⌘F, doc 16): where a term occurs in a paragraph's text, read whole.
 *
 * The syntax around the words is not prose and is never a match, so a replace cannot
 * rewrite it: a speaker tag (`<Calder>`), the `@` of a mention, the `[[ ]]` of a place.
 * Their words still are ("Calder" in "@Calder" is found). Matches never overlap, so
 * replacing them all replaces each once.
 */
export interface FindOptions {
  caseSensitive?: boolean;
  /** Only where the term is a whole word: "Tom" is not found in "Tomorrow". */
  wholeWord?: boolean;
}

const NO_NAMES = makeLexicon([]);

/** The stretches of syntax in a paragraph's text: never part of a match. */
function syntaxRanges(text: string): [number, number][] {
  const out: [number, number][] = findSpeakerTags(text).map((t) => [t.tagStart, t.end]);
  for (const m of findMentions(text, NO_NAMES)) {
    if (m.kind === "character") out.push([m.start, m.start + 1]);
    else out.push([m.start, m.start + 2], [m.end - 2, m.end]);
  }
  return out;
}

export function findInText(text: string, term: string, opts: FindOptions = {}): [number, number][] {
  if (!term) return [];
  const hay = opts.caseSensitive ? text : text.toLowerCase();
  const needle = opts.caseSensitive ? term : term.toLowerCase();
  const syntax = syntaxRanges(text);
  const out: [number, number][] = [];
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    const end = i + needle.length;
    const whole = !opts.wholeWord || (!isWordChar(text[i - 1]) && !isWordChar(text[end]));
    if (whole && !syntax.some(([a, b]) => i < b && a < end)) {
      out.push([i, end]);
      i = end;
    } else {
      i += 1;
    }
  }
  return out;
}
