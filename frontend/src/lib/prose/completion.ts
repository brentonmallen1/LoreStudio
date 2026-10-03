/**
 * Completing the inline syntax as it is typed (doc 16, T2): which picker the text before
 * the cursor asks for, what it suggests, and the faint rest of the top suggestion that Tab
 * takes. Pure, so the rules are tested apart from the editor (completion.test.ts).
 *
 *     @Ele         a character or a place      (after a space, a line start, “ ( [ — –)
 *     [[Kee        a place
 *     ”<Ca         who says the line just closed (a space before < is fine)
 *     ^            a new line of dialogue for someone
 */

import { foldName } from "./syntax";

export type TriggerMode = "mention" | "place" | "speaker" | "line";

export interface Trigger {
  mode: TriggerMode;
  query: string;
  /** Where in the text before the cursor the typed syntax starts: the @, the [[, the ^,
   * or the first character after < (a speaker's name replaces only the name). */
  start: number;
}

const OPENS = '(^|[\\s(\\[“"‘—–])';
const SPEAKER = new RegExp("[\"”'’][  ]?<([^<>\\n]{0,40})$");
const PLACE = /\[\[([^[\]\n]{0,40})$/;
const LINE = new RegExp(`${OPENS}\\^([^\\s^]*)$`);
const MENTION = new RegExp(`${OPENS}@([^\\n@<>[\\]]{0,40})$`);

/**
 * The picker the text before the cursor asks for, if any. A mention's query may hold
 * spaces ("@Dr. Pri") while some name still starts with it; otherwise a space ends it.
 */
export function detectTrigger(before: string, hasMatch: (query: string) => boolean): Trigger | null {
  let m = SPEAKER.exec(before);
  if (m) return { mode: "speaker", query: m[1], start: before.length - m[1].length };
  m = PLACE.exec(before);
  if (m) return { mode: "place", query: m[1], start: before.length - m[0].length };
  m = LINE.exec(before);
  if (m) return { mode: "line", query: m[2], start: before.length - m[2].length - 1 };
  m = MENTION.exec(before);
  if (m) {
    const query = m[2];
    if (/^\s/.test(query) || (/\s/.test(query) && !hasMatch(query))) return null;
    return { mode: "mention", query, start: before.length - query.length - 1 };
  }
  return null;
}

export interface Entry {
  kind: "character" | "place";
  name: string;
  aliases?: string[];
  role?: string;
  slot?: number;
}

export interface Choice {
  kind: "character" | "place";
  /** The entry's own name, or the new one's. */
  name: string;
  /** What goes in the prose: the name, or the other name typed ("Tom"). */
  words: string;
  /** Set when `words` is another name for `name`. */
  via?: string;
  /** A new entry, made when chosen. */
  create?: boolean;
  role?: string;
  slot?: number;
}

const KINDS: Record<TriggerMode, Entry["kind"][]> = {
  mention: ["character", "place"],
  place: ["place"],
  speaker: ["character"],
  line: ["character"],
};

const LIMIT = 8;

/** Whether some name or other name of the given kinds starts with the query. */
export function anyStartsWith(query: string, entries: Entry[], kinds: Entry["kind"][]): boolean {
  const q = foldName(query);
  return entries.some(
    (e) => kinds.includes(e.kind) && [e.name, ...(e.aliases ?? [])].some((n) => foldName(n).startsWith(q)),
  );
}

/**
 * What a picker offers: names (and other names) that start with the query, then names
 * with a word that does; the likeliest speaker first when there is one; and, when nothing
 * is called exactly that, a new entry by that name.
 */
export function suggest(
  mode: TriggerMode,
  query: string,
  entries: Entry[],
  preferred: string | null = null,
): Choice[] {
  const kinds = KINDS[mode];
  const q = foldName(query);
  const scored: { choice: Choice; score: number }[] = [];
  for (const e of entries) {
    if (!kinds.includes(e.kind)) continue;
    let nameMatched = false;
    for (const words of [e.name, ...(e.aliases ?? [])]) {
      const f = foldName(words);
      const score = f.startsWith(q) ? 0 : f.split(/[^\p{L}\p{N}']+/u).some((w) => w.startsWith(q)) ? 1 : -1;
      if (score < 0) continue;
      const via = words === e.name ? undefined : words;
      if (!via) nameMatched = true;
      // Another name is offered when it is what was typed: not when the name itself
      // already matches, and not as a second copy of everyone in an empty picker.
      if (via && (!q || nameMatched)) continue;
      scored.push({
        choice: { kind: e.kind, name: e.name, words, via, role: e.role, slot: e.slot },
        score: score + (e.name === preferred ? -2 : 0) + (via ? 0.5 : 0),
      });
    }
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      (a.choice.kind === b.choice.kind ? 0 : a.choice.kind === "character" ? -1 : 1) ||
      a.choice.words.localeCompare(b.choice.words),
  );
  const seen = new Set<string>();
  const out: Choice[] = [];
  for (const { choice } of scored) {
    const key = `${choice.kind}:${choice.name}:${choice.words}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(choice);
  }
  const shown = out.slice(0, LIMIT);
  const exact = entries.some(
    (e) => kinds.includes(e.kind) && [e.name, ...(e.aliases ?? [])].some((n) => foldName(n) === q),
  );
  if (q && !exact) {
    const name = query.trim();
    shown.push({ kind: mode === "place" ? "place" : "character", name, words: name, create: true });
  }
  return shown;
}

/** The rest of a suggestion after what has been typed, shown faintly; Tab takes it. */
export function ghostText(query: string, choice: Choice | undefined): string {
  if (!choice || choice.create || !query) return "";
  return foldName(choice.words).startsWith(foldName(query)) ? choice.words.slice(query.length) : "";
}

/** The quote marks a new line gets: whichever the scene already uses most (curly when
 * there are none yet, as the editor curls what is typed). */
export function quotePair(text: string): [string, string] {
  const curly = (text.match(/[“”]/g) ?? []).length;
  const straight = (text.match(/"/g) ?? []).length;
  return straight > curly ? ['"', '"'] : ["“", "”"];
}
