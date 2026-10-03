/**
 * The prose's inline syntax, defined once (doc 16, D2): the editor's half of
 * `backend/app/services/prose_syntax.py`. Both run every case in
 * `shared/prose-syntax/cases.json`, so the editor and the server read the prose alike.
 *
 *     @Name               a character        @Eleanor Vance, @Tom, @O'Brien
 *     [[Place]]           a place            [[Keeper's Cottage]]
 *     "spoken"<Name>      who says the line  "I know."<Calder>, “I know.” <Calder>, ‘No.’<Maya>
 *
 * It reads a paragraph's text (lib/prose/blockText), never a single text node. Lenient where
 * a writer cannot see the difference (capitals, curly or straight quotes, a space before
 * `<Name>`, `’s` after a mention); strict where prose is not syntax (me@host.com, x < 5).
 */

export type MentionKind = "character" | "place";

/** A name as compared: any case, any apostrophe, single spaces. */
export function foldName(name: string): string {
  return name.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

const WORD = /[\p{L}\p{M}\p{N}_]/u;
const LETTER = /\p{L}/u;
export const isWordChar = (ch: string | undefined) => !!ch && WORD.test(ch);

export interface KnownName {
  kind: MentionKind;
  name: string;
  aliases?: string[];
}

export interface Lexicon {
  places: Map<string, string>;
  characters: Map<string, string>;
  /** What a mention may say: names, other names, and short forms only one character has. */
  mentionable: Map<string, string>;
  /** Folded mentionable names, longest first. */
  characterKeys: string[];
  /** Each folded name form ("calder", "thomas") and the characters who answer to it. */
  forms: Map<string, Set<string>>;
}

const PARENTHETICAL = /^(.*?)\s*\(([^)]+)\)\s*$/;
const ARTICLES = new Set(["the", "a", "an"]);
/** Words before a name that are not the name (the server's `_TITLES`). */
const TITLES = new Set(
  (
    "dr doctor mr mrs ms miss mx sir dame lady lord madam madame captain capt commander general " +
    "colonel major lieutenant sergeant admiral professor prof father mother sister brother aunt " +
    "uncle detective inspector officer agent king queen prince princess reverend rev"
  ).split(" "),
);

/**
 * The ways prose refers to a character by name: the full name, either half of "The Visitor
 * (Calder)", and a longer name's first word unless it is an article ("Eleanor", not "The")
 * or a title ("Dr. Priya Sharma" is "Priya" or "Dr. Sharma", never "Dr.").
 */
export function nameForms(label: string): Set<string> {
  const clean = label.split(/\s+/).filter(Boolean).join(" ");
  if (!clean) return new Set();
  const forms = new Set([clean]);
  let parts = [clean];
  const m = PARENTHETICAL.exec(clean);
  if (m) {
    parts = [m[1], m[2]];
    for (const p of parts) if (p) forms.add(p);
  }
  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length < 2 || ARTICLES.has(words[0].toLowerCase())) continue;
    if (TITLES.has(words[0].toLowerCase().replace(/\.+$/, ""))) {
      // "Dr. Priya Sharma" is "Priya" or "Dr. Sharma" on the page, never "Dr.".
      if (words.length > 2) forms.add(words[1]);
      forms.add(`${words[0]} ${words[words.length - 1]}`);
    } else forms.add(words[0]);
  }
  return forms;
}

export function makeLexicon(known: KnownName[]): Lexicon {
  const places = new Map<string, string>();
  const characters = new Map<string, string>();
  const forms = new Map<string, Set<string>>();
  for (const k of known) {
    const into = k.kind === "character" ? characters : places;
    for (const n of [k.name, ...(k.aliases ?? [])]) {
      const key = n?.trim() ? foldName(n) : "";
      if (!key) continue;
      if (!into.has(key)) into.set(key, k.name);
      if (k.kind === "character")
        for (const f of nameForms(n)) {
          const owners = forms.get(foldName(f)) ?? new Set<string>();
          owners.add(k.name);
          forms.set(foldName(f), owners);
        }
    }
  }
  // A mention answers to a name or other name, and to a shorter form of one ("@Eleanor",
  // "@Calder") when only one character goes by it.
  const mentionable = new Map(characters);
  for (const [key, owners] of forms)
    if (owners.size === 1 && !mentionable.has(key)) mentionable.set(key, [...owners][0]);
  const characterKeys = [...mentionable.keys()].sort((a, b) => b.length - a.length);
  return { places, characters, mentionable, characterKeys, forms };
}

/**
 * Who a speaker tag names: a name or other name in any case, or a shorter form of one
 * ("Calder", "Thomas") when only one character answers to it.
 */
export function speakerName(lex: Lexicon, written: string): string | null {
  const key = foldName(written);
  const named = lex.characters.get(key);
  if (named) return named;
  const owners = lex.forms.get(key);
  return owners && owners.size === 1 ? [...owners][0] : null;
}

export interface Mention {
  kind: MentionKind;
  start: number;
  end: number;
  /** The words inside the syntax, as written ("Tom", "the keeper’s cottage"). */
  written: string;
  /** The entry they name (its own name), or null when they name nobody. */
  name: string | null;
}

/** End of a one-word name: letters and digits, inner ' or - kept, a trailing 's left out. */
function unknownWordEnd(text: string, i: number): number {
  let j = i;
  while (j < text.length) {
    if (isWordChar(text[j])) j++;
    else if ("'’-".includes(text[j]) && isWordChar(text[j + 1])) j++;
    else break;
  }
  if (j - i > 2 && "'’".includes(text[j - 2]) && "sS".includes(text[j - 1])) j -= 2;
  return j;
}

function knownAt(text: string, i: number, lex: Lexicon): [number, string] | null {
  for (const key of lex.characterKeys) {
    const end = i + key.length;
    if (end > text.length || foldName(text.slice(i, end)) !== key) continue;
    if (isWordChar(text[end])) continue;
    return [end, lex.mentionable.get(key)!];
  }
  return null;
}

const PLACE = /\[\[([^[\]\n￼]+)\]\]/g;

export function findMentions(text: string, lex: Lexicon): Mention[] {
  const out: Mention[] = [];
  let i = 0;
  while ((i = text.indexOf("@", i)) !== -1) {
    const at = i;
    i += 1;
    if (at > 0 && isWordChar(text[at - 1])) continue; // an address: me@host.com
    if (i >= text.length || !LETTER.test(text[i])) continue;
    const found = knownAt(text, i, lex);
    const [end, name] = found ?? [unknownWordEnd(text, i), null];
    out.push({ kind: "character", start: at, end, written: text.slice(i, end), name });
    i = end;
  }
  for (const m of text.matchAll(PLACE)) {
    const written = m[1].trim();
    if (!written) continue;
    const start = m.index ?? 0;
    out.push({
      kind: "place",
      start,
      end: start + m[0].length,
      written,
      name: lex.places.get(foldName(written)) ?? null,
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

export interface SpeakerTag {
  /** The quoted line, its quote marks included. */
  quoteStart: number;
  quoteEnd: number;
  /** The tag, from its "<" (or the space before it) to its ">". */
  tagStart: number;
  end: number;
  speaker: string;
}

// Built from a string so the no-break space stays an escape (a literal one is invisible).
const TAG = new RegExp("([\"\u201d'\u2019])[ \\t\\u00a0]?<([^<>\\n]{1,80})>", "g");
// What can come before a single quote that opens a line (the last is a no-break space).
const SINGLE_BOUNDARY = ' \t\n([—–“" ';

/** Where the quote that ends at `close` begins. */
function opening(text: string, close: number): number | null {
  if ('"”'.includes(text[close])) {
    const j = Math.max(text.lastIndexOf('"', close - 1), text.lastIndexOf("“", close - 1));
    return j >= 0 ? j : null;
  }
  // A single quote: a ‘, or a ' that starts a word (not the one in "don't").
  for (let j = close - 1; j >= 0; j--) {
    const ch = text[j];
    if (ch === "‘" || (ch === "'" && (j === 0 || SINGLE_BOUNDARY.includes(text[j - 1])))) return j;
    if ('"”“'.includes(ch)) return null;
  }
  return null;
}

export function findSpeakerTags(text: string): SpeakerTag[] {
  const out: SpeakerTag[] = [];
  for (const m of text.matchAll(TAG)) {
    const close = m.index ?? 0;
    const speaker = m[2].trim();
    const open = opening(text, close);
    if (!speaker || open === null || close - open < 2) continue;
    out.push({
      quoteStart: open,
      quoteEnd: close + 1,
      tagStart: close + 1,
      end: close + m[0].length,
      speaker,
    });
  }
  return out;
}

const QUOTE = new RegExp(
  '\u201c([^\u201c\u201d"]+)[\u201d"]|(?:^|(?<=[\\s(\\[\u2014\u2013]))"([^\u201c\u201d"]+)[\u201d"]',
  "g",
);

export interface Quote {
  start: number;
  end: number;
  /** The words inside the quote marks, trimmed. */
  words: string;
}

/**
 * Double-quoted passages that carry no speaker tag: “…” anywhere, "…" where a quote can open
 * (a line start, a space, a bracket, a dash). Single quotes are apostrophes until tagged.
 */
export function findQuotes(text: string): Quote[] {
  const tagged = findSpeakerTags(text).map((t) => [t.quoteStart, t.end]);
  const out: Quote[] = [];
  for (const m of text.matchAll(QUOTE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const words = (m[1] ?? m[2] ?? "").trim();
    if (words && !tagged.some(([a, b]) => a < end && start < b)) out.push({ start, end, words });
  }
  return out;
}

const NO_NAMES = makeLexicon([]);

/** The prose as a reader sees it: no `@`, no `[[ ]]`, no `<Name>` after a line. */
export function readerText(text: string): string {
  const cuts: [number, number, string][] = findSpeakerTags(text).map((t) => [t.tagStart, t.end, ""]);
  for (const m of findMentions(text, NO_NAMES))
    cuts.push(m.kind === "character" ? [m.start, m.start + 1, ""] : [m.start, m.end, m.written]);
  cuts.sort((a, b) => a[0] - b[0]);
  let out = "";
  let last = 0;
  for (const [start, end, keep] of cuts) {
    if (start < last) continue;
    out += text.slice(last, start) + keep;
    last = end;
  }
  return out + text.slice(last);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Who prose names, by the server's presence rule (codex/presence.name_patterns): each
 * character's name forms and other names, minus any form two characters share (two Vances
 * make "Vance" nobody's); a one-word form only as capitalised, so "will" is not Will; an
 * `@` before it is fine. Returns each character's patterns, longest form first.
 */
export function presencePatterns(known: KnownName[]): Map<string, RegExp[]> {
  const cast = known.filter((k) => k.kind === "character");
  const forms = new Map(
    cast.map((k) => [k.name, new Set([k.name, ...(k.aliases ?? [])].flatMap((n) => [...nameForms(n)]))]),
  );
  const owners = new Map<string, number>();
  for (const fs of forms.values())
    for (const f of fs) owners.set(f.toLowerCase(), (owners.get(f.toLowerCase()) ?? 0) + 1);
  return new Map(
    cast.map((k) => [
      k.name,
      [...forms.get(k.name)!]
        .filter((f) => owners.get(f.toLowerCase()) === 1)
        .sort((a, b) => b.length - a.length)
        .map(
          (f) =>
            new RegExp(
              `(?<![\\p{L}\\p{M}\\p{N}_@])@?${escapeRe(f)}(?![\\p{L}\\p{M}\\p{N}_])`,
              f.includes(" ") ? "giu" : "gu",
            ),
        ),
    ]),
  );
}

/** How many times a character is named in some text, by their patterns, never counting
 * one stretch twice ("Eleanor Vance" is one naming, not also "Eleanor"). */
export function timesNamed(text: string, patterns: RegExp[]): number {
  const taken: [number, number][] = [];
  for (const re of patterns)
    for (const m of text.matchAll(re)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      if (!taken.some(([x, y]) => a < y && x < b)) taken.push([a, b]);
    }
  return taken.length;
}
