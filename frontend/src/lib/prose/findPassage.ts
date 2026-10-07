import type { Node as PMNode } from "@tiptap/pm/model";
import { forEachBlockText } from "./blockText";
import { findMentions, findSpeakerTags, isWordChar, makeLexicon } from "./syntax";

/**
 * Where a finding's quoted passage is in a scene: the words a check rests on, found again
 * in the prose so the editor can show them.
 *
 * The quote comes from the reader's text (spaCy, a model, an excerpt), so the prose is read
 * the same way before it is searched: no `<Name>` after a line, no `@` or `[[ ]]` around a
 * name, straight quotes, lower case, one space (the backend's `fingerprint.normalise`). An
 * excerpt's "…" ends are dropped. A whole-word match wins over one inside a word ("Tom" in
 * "Tomorrow"); a quote longer than 80 characters that no longer matches whole is found by its
 * opening, which is all the server checked when it kept the finding.
 */

const NO_NAMES = makeLexicon([]);
const PREFIX = 80;
const QUOTES: Record<string, string> = { "“": '"', "”": '"', "‘": "'", "’": "'", "…": "..." };

/** The prose as the reader reads it, normalised, with each character's index in `text`. */
function readerIndex(text: string): { read: string; at: number[] } {
  const cuts: [number, number, number][] = findSpeakerTags(text).map((t) => [t.tagStart, t.end, 0]);
  for (const m of findMentions(text, NO_NAMES))
    if (m.kind === "character") cuts.push([m.start, m.start + 1, 0]);
    else cuts.push([m.start, m.start + 2, 0], [m.end - 2, m.end, 0]);
  cuts.sort((a, b) => a[0] - b[0]);
  let read = "";
  const at: number[] = [];
  let cut = 0;
  for (let i = 0; i < text.length; i++) {
    while (cut < cuts.length && cuts[cut][1] <= i) cut++;
    if (cut < cuts.length && cuts[cut][0] <= i) continue;
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (read && read[read.length - 1] !== " ") {
        read += " ";
        at.push(i);
      }
      continue;
    }
    for (const c of (QUOTES[ch] ?? ch).toLowerCase()) {
      read += c;
      at.push(i);
    }
  }
  return { read, at };
}

/** A quote in the same form: normalised, its excerpt ellipses and outer spaces dropped. */
export function normalisePassage(passage: string): string {
  const { read } = readerIndex(passage);
  return read.replace(/^[\s.]+|[\s.]+$/g, "");
}

function matches(read: string, needle: string): { at: number; whole: boolean }[] {
  const out: { at: number; whole: boolean }[] = [];
  let i = 0;
  while ((i = read.indexOf(needle, i)) !== -1) {
    out.push({ at: i, whole: !isWordChar(read[i - 1]) && !isWordChar(read[i + needle.length]) });
    i += 1;
  }
  return out;
}

/** Where `passage` is in a document, or null when the words have changed. */
export function findPassage(doc: PMNode, passage: string): { from: number; to: number } | null {
  const needle = normalisePassage(passage);
  if (!needle) return null;
  const blocks: { read: string; to: (start: number, end: number) => { from: number; to: number } }[] = [];
  forEachBlockText(doc, ({ text, range }) => {
    const { read, at } = readerIndex(text);
    blocks.push({ read, to: (start, end) => range(at[start], at[end - 1] + 1) });
  });
  for (const want of needle.length > PREFIX ? [needle, needle.slice(0, PREFIX).trimEnd()] : [needle]) {
    let part: { from: number; to: number } | null = null;
    for (const b of blocks)
      for (const m of matches(b.read, want)) {
        if (m.whole) return b.to(m.at, m.at + want.length);
        part ??= b.to(m.at, m.at + want.length);
      }
    if (part) return part;
  }
  return null;
}
