/**
 * A screenplay's elements, as both sides read them (doc 25).
 *
 * A script scene is a run of blocks, each one element. The editor stores the element on the
 * paragraph (`<p data-el="cue">`); this module says what each element is, how typed or pasted
 * Fountain-style text is sorted into elements, what Enter and Tab move to, and how the blocks
 * lay out on a page. The server's twin is backend/app/services/script_syntax.py, and
 * shared/script-syntax/cases.json is run by both, so the page count shown here is the one the
 * PDF prints. Courier 12pt: ten characters to the inch, six lines, 55 lines to a Letter page.
 */

export type ScriptElement =
  "heading" | "action" | "cue" | "paren" | "dialogue" | "transition" | "centered" | "lyric";
export type Block = [ScriptElement, string];

export const ELEMENTS: ScriptElement[] = [
  "heading",
  "action",
  "cue",
  "paren",
  "dialogue",
  "transition",
  "centered",
  "lyric",
];

/** What a cue's speech is made of (doc 25, P8: a sung line belongs to its singer). */
const SPEECH: ScriptElement[] = ["paren", "dialogue", "lyric"];

/** Elements whose text is written in capitals (typed so, not styled so). */
export const CAPITALS: ScriptElement[] = ["heading", "cue", "transition"];

export const ELEMENT_LABELS: Record<ScriptElement, string> = {
  heading: "Scene heading",
  action: "Action",
  cue: "Character",
  paren: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  centered: "Centred",
  lyric: "Lyric",
};

/** A play names three of them for the theatre (doc 25, P9). */
const STAGE_LABELS: Partial<Record<ScriptElement, string>> = {
  heading: "Act or scene",
  action: "Stage direction",
  paren: "Direction",
};

/** An element's name in a story of this format. */
export function elementLabel(element: ScriptElement, fmt?: string | null): string {
  return (fmt === "stage_play" && STAGE_LABELS[element]) || ELEMENT_LABELS[element];
}

/** Where Enter goes from each element (Final Draft's defaults). */
export const ENTER_NEXT: Record<ScriptElement, ScriptElement> = {
  heading: "action",
  action: "action",
  cue: "dialogue",
  paren: "dialogue",
  dialogue: "action",
  transition: "heading",
  centered: "action",
  lyric: "lyric",
};

/** What Tab turns the line into, and Shift-Tab back: extras for Final Draft hands (D2). */
export const TAB_NEXT: Record<ScriptElement, ScriptElement> = {
  action: "cue",
  cue: "transition",
  transition: "heading",
  heading: "action",
  dialogue: "paren",
  paren: "dialogue",
  centered: "action",
  lyric: "dialogue",
};
export const SHIFT_TAB_NEXT: Record<ScriptElement, ScriptElement> = {
  action: "heading",
  heading: "transition",
  transition: "cue",
  cue: "action",
  dialogue: "cue",
  paren: "dialogue",
  centered: "action",
  lyric: "dialogue",
};

export const LINES_PER_PAGE = 55;
/** Each element's left edge in characters from the 1.5in margin, its width, blank lines before,
 *  and where it is not set left its alignment within that width; `italic` where it prints so. */
export interface Spec {
  x: number;
  width: number;
  before: number;
  align?: "right" | "center";
  italic?: boolean;
}
export const LAYOUT: Record<ScriptElement, Spec> = {
  heading: { x: 0, width: 60, before: 1 },
  action: { x: 0, width: 60, before: 1 },
  cue: { x: 22, width: 38, before: 1 },
  paren: { x: 16, width: 19, before: 0 },
  dialogue: { x: 10, width: 35, before: 0 },
  transition: { x: 0, width: 60, before: 1, align: "right" },
  centered: { x: 0, width: 60, before: 1, align: "center" },
  lyric: { x: 10, width: 35, before: 0, italic: true },
};
/** A stage play's page (doc 25, P9), as the Dramatists Guild lays one out: the name centred in
 *  capitals, the speech the full width under it, stage directions in italics from halfway. */
export const STAGE_LAYOUT: Record<ScriptElement, Spec> = {
  heading: { x: 0, width: 60, before: 1, align: "center" },
  action: { x: 20, width: 40, before: 1, italic: true },
  cue: { x: 0, width: 60, before: 1, align: "center" },
  paren: { x: 10, width: 30, before: 0, italic: true },
  dialogue: { x: 0, width: 60, before: 0 },
  transition: { x: 0, width: 60, before: 1, align: "right" },
  centered: { x: 0, width: 60, before: 1, align: "center" },
  lyric: { x: 0, width: 60, before: 0, italic: true },
};

/** The layout table for a script format; a screenplay's for anything else. */
export function layoutFor(fmt?: string | null): Record<ScriptElement, Spec> {
  return fmt === "stage_play" ? STAGE_LAYOUT : LAYOUT;
}
/** Two speeches at once (doc 25, P8) sit side by side, each in a column 29 characters wide:
 *  where each element of a speech goes within its column, and how wide it runs. */
export const DUAL_COLUMN = 29;
export const DUAL_RIGHT = 31;
export const DUAL_LAYOUT: Partial<Record<ScriptElement, { x: number; width: number }>> = {
  cue: { x: 9, width: 20 },
  paren: { x: 4, width: 19 },
  dialogue: { x: 1, width: 27 },
  lyric: { x: 1, width: 27 },
};
/** The fewest lines of action or dialogue left on either side of a page break. */
const MIN_SPLIT = 2;

const HEADING = /^(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E)[.\s]/i;
/** A stage play's scenes open on a marker: "ACT ONE", "SCENE 2", "Act Two, Scene 3". */
const STAGE_HEADING =
  /^(?:ACT|SCENE)\s+(?:[0-9]+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b/i;
const FORCED_HEADING = /^\.(?=[A-Za-z0-9])/;
const EXTENSION = /\s*\(([^()]*)\)/g;
const SENTENCE_END = /[.?!…—-]['"’”)]*$/;
const TITLES = ["MR.", "MRS.", "MS.", "DR.", "ST."];

export function isElement(value: unknown): value is ScriptElement {
  return typeof value === "string" && (ELEMENTS as string[]).includes(value);
}

/** Written in capitals: it has letters, and none of them is lower case. */
export function isCapitals(text: string): boolean {
  return /\p{L}/u.test(text) && text === text.toUpperCase();
}

export interface Cue {
  name: string;
  extensions: string[];
  /** Fountain's "^": spoken at the same time as the speech before it. */
  dual: boolean;
}

export function parseCue(text: string): Cue {
  let t = text.trim();
  const dual = t.endsWith("^");
  if (dual) t = t.slice(0, -1).trimEnd();
  if (t.startsWith("@")) t = t.slice(1);
  const extensions = [...t.matchAll(EXTENSION)].map((m) => m[1].trim());
  const name = t.replace(EXTENSION, "").trim();
  return { name, extensions, dual };
}

const TITLED = /^(the|mr|mrs|ms|miss|dr|doctor|captain|sir|lady|lord|father|mother|aunt|uncle)\b/i;

/**
 * The cue a script writes for a character: what people call them, in capitals. A full name
 * is cued by its first name ("Eleanor Vance" is ELEANOR); "The Visitor (Calder)" and a name
 * with a title keep their words (THE VISITOR, DR. PRIYA SHARMA); another name the author
 * typed ("Nell") is used as written.
 */
export function cueName(name: string): string {
  const plain = name
    .replace(/\s*\([^()]*\)/g, "")
    .trim()
    .replace(/\s+/g, " ");
  const words = plain.split(" ");
  return (words.length > 1 && !TITLED.test(plain) ? words[0] : plain).toUpperCase();
}

/** A name in capitals, perhaps with extensions; "BOOM!" or "SILENCE." is loud action. */
export function looksLikeCue(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 38 || t.startsWith("!")) return false;
  if (t.startsWith("@")) return t.length > 1;
  const name = parseCue(t).name;
  if (!name || !isCapitals(name) || HEADING.test(t + " ")) return false;
  return !/[.!?:;,]$/.test(name) || TITLES.some((title) => name.endsWith(title));
}

/** The element a typed or pasted line is, given the element before it (null at the top). */
export function classifyLine(text: string, prev: ScriptElement | null, fmt?: string | null): ScriptElement {
  const t = text.trim();
  if (!t) return "action";
  if (FORCED_HEADING.test(t) || (fmt === "stage_play" ? STAGE_HEADING : HEADING).test(t + " "))
    return "heading";
  if (t.startsWith("!")) return "action";
  if (t.startsWith(">") && t.endsWith("<") && t.length > 2) return "centered";
  if (t.startsWith(">")) return "transition";
  if (t.startsWith("~")) return "lyric";
  const speaking = prev === "cue" || (prev !== null && SPEECH.includes(prev));
  if (speaking && t.startsWith("(") && t.endsWith(")")) return "paren";
  if (speaking) return "dialogue";
  if (isCapitals(t) && t.endsWith("TO:")) return "transition";
  if (t.startsWith("@") || looksLikeCue(t)) return "cue";
  return "action";
}

/** A line's text as stored: forcing marks off, capitals where the element takes them. */
export function clean(element: ScriptElement, text: string): string {
  let t = text.trim();
  if (element === "heading" && FORCED_HEADING.test(t)) t = t.slice(1);
  else if (element === "action" && t.startsWith("!")) t = t.slice(1);
  else if (element === "cue" && t.startsWith("@"))
    return t.slice(1); // keeps McCLANE's own capitals
  else if (element === "transition" && t.startsWith(">")) t = t.slice(1).trim();
  else if (element === "centered" && t.startsWith(">") && t.endsWith("<")) t = t.slice(1, -1).trim();
  else if (element === "lyric" && t.startsWith("~")) t = t.slice(1).trim();
  return CAPITALS.includes(element) ? t.toUpperCase() : t;
}

/** How a heading says where the camera is, as stored ("INT/EXT"), and as printed ("INT./EXT."). */
export const INTERIORS: Record<string, string> = {
  INT: "INT.",
  EXT: "EXT.",
  "INT/EXT": "INT./EXT.",
  "EXT/INT": "EXT./INT.",
  EST: "EST.",
};
const SLUG_PREFIX = /^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)\.?\s+/i;
const SCENE_NUMBER = /\s*#[^#]*#\s*$/;

/** A scene heading read: "INT. KEEPER'S COTTAGE - NIGHT" is INT, KEEPER'S COTTAGE, NIGHT. */
export interface Slug {
  interior: string;
  place: string;
  time: string;
}

/** A heading's parts. The time is what follows the last " - "; what is between is the place. */
export function parseSlugline(text: string): Slug {
  let t = text.trim().replace(SCENE_NUMBER, "");
  if (FORCED_HEADING.test(t)) t = t.slice(1);
  let interior = "";
  const m = SLUG_PREFIX.exec(t);
  if (m) {
    const word = m[1].toUpperCase().replace(/\./g, "");
    interior = word === "I/E" ? "INT/EXT" : word;
    t = t.slice(m[0].length);
  }
  const cut = t.lastIndexOf(" - ");
  const [place, time] = cut < 0 ? [t, ""] : [t.slice(0, cut), t.slice(cut + 3)];
  return { interior, place: place.trim(), time: time.trim() };
}

/** A heading from its parts, the way it prints. */
export function formatSlugline(slug: Slug): string {
  const head = [INTERIORS[slug.interior] ?? slug.interior, slug.place.toUpperCase()]
    .filter(Boolean)
    .join(" ");
  return slug.time ? `${head} - ${slug.time.toUpperCase()}` : head;
}

/** Inside or out, and when, as a script scene's heading says them ("INT. · NIGHT"), for the
 * glances that show the scene; null when the heading says neither (or the story is prose). */
export function shotOf(node: { interior?: string; time_of_day?: string }): string | null {
  const parts = [node.interior ? (INTERIORS[node.interior] ?? node.interior) : "", node.time_of_day ?? ""];
  return parts.filter(Boolean).join(" · ") || null;
}

const OPENING = /^FADE IN\W*$/i;
/** A play's act marker, "ACT TWO": it opens the act's first scene, and a new page. */
const ACT = /^ACT\s+\S/i;

export function isAct(element: string | null, text: string): boolean {
  return element === "heading" && ACT.test(text.trim());
}

/** Where a scene's own heading is, among its blocks: its first line, or the first after the
 *  lines that open a script ("FADE IN:", a transition). A heading further down starts another
 *  scene. The server's `heading_at`. */
export function headingAt(blocks: [string | null, string][]): number {
  let i = 0;
  while (
    i < blocks.length &&
    (blocks[i][0] === "transition" || OPENING.test(blocks[i][1].trim()) || isAct(blocks[i][0], blocks[i][1]))
  )
    i++;
  return i;
}

/** Fountain-style text, pasted or imported, as blocks (see the server's `parse_lines`). */
export function parseLines(text: string, fmt?: string | null): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let prev: ScriptElement | null = null;
  let blankBefore = true;
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (prev === "cue" || (prev !== null && SPEECH.includes(prev))) prev = "action";
      blankBefore = true;
      return;
    }
    const next = i + 1 < lines.length ? lines[i + 1].trim() : "";
    let el = classifyLine(line, blankBefore ? null : prev, fmt);
    if (el === "cue" && !line.trim().startsWith("@") && (!blankBefore || !next)) el = "action";
    if (el === "heading" && !blankBefore && !FORCED_HEADING.test(line.trim())) el = "action";
    const last = blocks[blocks.length - 1];
    if (last && !blankBefore && el === last[0] && (el === "action" || el === "dialogue" || el === "lyric"))
      last[1] = `${last[1]}\n${clean(el, line)}`;
    else blocks.push([el, clean(el, line)]);
    prev = el;
    blankBefore = false;
  });
  return blocks;
}

// ── The page ──────────────────────────────────────────────────────────────────────────

/** Greedy word wrap; a line break always breaks; lines after the first are `hang` narrower. */
export function wrap(text: string, width: number, hang = 0): string[] {
  const out: string[] = [];
  const limit = () => width - (out.length ? hang : 0);
  for (const part of text.split("\n")) {
    let line = "";
    for (let word of part.split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length <= limit()) {
        line += " " + word;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      while (word.length > limit()) {
        const cut = limit();
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      line = word;
    }
    out.push(line);
  }
  return out;
}

export interface Line {
  element: ScriptElement | "more";
  text: string;
  /** Left edge, in characters from the 1.5in margin. */
  x: number;
}
export interface Page {
  /** Lines from the top; null is a blank line. */
  lines: (Line | null)[];
  /** The right-hand speech of dual dialogue, by row: the line beside `lines[row]`. */
  beside: Record<number, Line>;
}

/** One block's lines on the page, wrapped and placed. */
export function blockLines(element: ScriptElement, text: string, fmt?: string | null): Line[] {
  const table = layoutFor(fmt);
  const spec = table[element] ?? table.action;
  const hang = element === "paren" ? 1 : 0;
  return wrap(text, spec.width, hang).map((t, i) => ({
    element,
    text: t,
    x:
      spec.align === "right"
        ? spec.x + Math.max(0, spec.width - t.length)
        : spec.align === "center"
          ? spec.x + Math.max(0, Math.floor((spec.width - t.length) / 2))
          : spec.x + (i ? hang : 0),
  }));
}

/** A cue as it prints: Fountain's dual mark off. */
export function shownCue(text: string): string {
  return text.trim().replace(/\s*\^$/, "");
}

/** One speech of dual dialogue, laid out in its column. */
function column(blocks: Block[], origin: number): Line[] {
  return blocks.flatMap(([element, text]) => {
    const spec = DUAL_LAYOUT[element] ?? DUAL_LAYOUT.dialogue!;
    const hang = element === "paren" ? 1 : 0;
    const body = element === "cue" ? shownCue(text) : text;
    return wrap(body, spec.width, hang).map((t, i) => ({
      element,
      text: t,
      x: origin + spec.x + (i ? hang : 0),
    }));
  });
}

/** Whether a speech at `end` is spoken at the same time as the one before it. */
function isDual(blocks: Block[], end: number): boolean {
  return end < blocks.length && blocks[end][0] === "cue" && parseCue(blocks[end][1]).dual;
}

function speechEnd(blocks: Block[], i: number): number {
  let j = i + 1;
  while (j < blocks.length && SPEECH.includes(blocks[j][0])) j++;
  return j;
}

function speechSplit(body: Line[], most: number): number | null {
  const dialogue = (lines: Line[]) => lines.filter((l) => l.element === "dialogue").length;
  for (let k = Math.min(most, body.length - MIN_SPLIT); k >= MIN_SPLIT; k--) {
    const last = body[k - 1];
    const after = body[k];
    if (last.element !== "dialogue" || (after.element !== "dialogue" && after.element !== "paren")) continue;
    if (!SENTENCE_END.test(last.text)) continue;
    if (dialogue(body.slice(0, k)) >= MIN_SPLIT && dialogue(body.slice(k)) >= MIN_SPLIT) return k;
  }
  return null;
}

function keepWith(blocks: Block[], i: number, fmt?: string | null): number {
  if (i + 1 >= blocks.length) return 0;
  const [element, text] = blocks[i + 1];
  const before = layoutFor(fmt)[element].before;
  if (element === "cue") {
    const end = speechEnd(blocks, i + 1);
    const body = blocks.slice(i + 2, end).reduce((n, [e, t]) => n + blockLines(e, t, fmt).length, 0);
    return before + 1 + Math.min(body, MIN_SPLIT);
  }
  return before + Math.min(blockLines(element, text, fmt).length, MIN_SPLIT);
}

/** Lay the blocks out on pages, the way the PDF prints them (see the server's `paginate`). */
export function paginate(input: Block[], linesPerPage = LINES_PER_PAGE, fmt?: string | null): Page[] {
  const table = layoutFor(fmt);
  const pages: Page[] = [{ lines: [], beside: {} }];
  const page = () => pages[pages.length - 1].lines;
  const gap = (element: ScriptElement) => (page().length ? table[element].before : 0);
  const room = (element: ScriptElement) => linesPerPage - page().length - gap(element);
  const put = (element: ScriptElement, lines: Line[]) => {
    page().push(...Array<null>(gap(element)).fill(null), ...lines);
  };
  const turn = () => {
    if (page().length) pages.push({ lines: [], beside: {} });
  };

  /** Two speeches at once, side by side; never split, they go over together. */
  const dual = (left: Line[], right: Line[]) => {
    if (Math.max(left.length, right.length) > room("cue")) turn();
    page().push(...Array<null>(gap("cue")).fill(null));
    const top = page().length;
    page().push(...left, ...Array<null>(Math.max(0, right.length - left.length)).fill(null));
    right.forEach((line, row) => (pages[pages.length - 1].beside[top + row] = line));
  };

  const place = (element: ScriptElement, lines: Line[], keep: number) => {
    if (lines.length + keep <= room(element)) return put(element, lines);
    while (element === "action" && lines.length >= 2 * MIN_SPLIT && room(element) >= MIN_SPLIT) {
      const take = Math.min(room(element), lines.length - MIN_SPLIT);
      put(element, lines.slice(0, take));
      turn();
      lines = lines.slice(take);
      if (lines.length + keep <= room(element)) return put(element, lines);
    }
    turn();
    put(element, lines);
  };

  const speech = (cueText: string, body: Line[]) => {
    cueText = shownCue(cueText);
    let head = blockLines("cue", cueText, fmt);
    for (;;) {
      const space = room("cue");
      if (head.length + body.length <= space) return put("cue", [...head, ...body]);
      let split = speechSplit(body, space - head.length - 1);
      if (split === null) {
        if (page().length) {
          turn();
          continue;
        }
        split = Math.max(1, space - head.length - 1);
      }
      const more = blockLines("cue", "(MORE)", fmt)[0].x;
      put("cue", [...head, ...body.slice(0, split), { element: "more", text: "(MORE)", x: more }]);
      turn();
      const cue = parseCue(cueText);
      const kept = cue.extensions
        .filter((e) => e.toUpperCase() !== "CONT'D")
        .map((e) => ` (${e})`)
        .join("");
      cueText = `${cue.name}${kept} (CONT'D)`;
      head = blockLines("cue", cueText, fmt);
      body = body.slice(split);
    }
  };

  const blocks = input.filter(([, t]) => t.trim());
  for (let i = 0; i < blocks.length;) {
    const [element, text] = blocks[i];
    if (element === "cue") {
      const end = speechEnd(blocks, i);
      if (isDual(blocks, end)) {
        const after = speechEnd(blocks, end);
        dual(column(blocks.slice(i, end), 0), column(blocks.slice(end, after), DUAL_RIGHT));
        i = after;
        continue;
      }
      speech(
        text,
        blocks.slice(i + 1, end).flatMap(([e, t]) => blockLines(e, t, fmt)),
      );
      i = end;
      continue;
    }
    if (fmt === "stage_play" && isAct(element, text)) turn(); // a play starts each act on a new page
    place(element, blockLines(element, text, fmt), element === "heading" ? keepWith(blocks, i, fmt) : 0);
    i++;
  }
  return pages;
}

/** How many pages the blocks print on (none for nothing). */
export function pageCount(blocks: Block[], fmt?: string | null): number {
  return blocks.some(([, t]) => t.trim()) ? paginate(blocks, LINES_PER_PAGE, fmt).length : 0;
}

/** Lines laid end to end, blank lines included: a scene's length. */
export function sceneLines(input: Block[], fmt?: string | null): number {
  const blocks = input.filter(([, t]) => t.trim());
  const table = layoutFor(fmt);
  let total = 0;
  for (let i = 0; i < blocks.length;) {
    const [element, text] = blocks[i];
    const gap = total ? (table[element] ?? table.action).before : 0;
    const end = element === "cue" ? speechEnd(blocks, i) : i + 1;
    if (element === "cue" && isDual(blocks, end)) {
      const after = speechEnd(blocks, end);
      const rows = Math.max(
        column(blocks.slice(i, end), 0).length,
        column(blocks.slice(end, after), DUAL_RIGHT).length,
      );
      total += gap + rows;
      i = after;
      continue;
    }
    total += gap + blockLines(element, text, fmt).length;
    i++;
  }
  return total;
}

/** A scene's length in eighths of a page, never less than one for a scene with words. */
export function eighths(lines: number): number {
  return lines <= 0 ? 0 : Math.max(1, Math.round((lines * 8) / LINES_PER_PAGE));
}

/** "⅜ page", "1 ⅝ pages": a scene's length the way a script breakdown writes it. */
export function formatEighths(n: number): string {
  if (n <= 0) return "";
  const whole = Math.floor(n / 8);
  const rest = n % 8;
  const frac = rest ? `${rest}/8` : "";
  const text = [whole ? String(whole) : "", frac].filter(Boolean).join(" ");
  return `${text} ${n <= 8 ? "page" : "pages"}`;
}
