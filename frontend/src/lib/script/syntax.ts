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

export type ScriptElement = "heading" | "action" | "cue" | "paren" | "dialogue" | "transition";
export type Block = [ScriptElement, string];

export const ELEMENTS: ScriptElement[] = ["heading", "action", "cue", "paren", "dialogue", "transition"];

/** Elements whose text is written in capitals (typed so, not styled so). */
export const CAPITALS: ScriptElement[] = ["heading", "cue", "transition"];

export const ELEMENT_LABELS: Record<ScriptElement, string> = {
  heading: "Scene heading",
  action: "Action",
  cue: "Character",
  paren: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
};

/** Where Enter goes from each element (Final Draft's defaults). */
export const ENTER_NEXT: Record<ScriptElement, ScriptElement> = {
  heading: "action",
  action: "action",
  cue: "dialogue",
  paren: "dialogue",
  dialogue: "action",
  transition: "heading",
};

/** What Tab turns the line into, and Shift-Tab back: extras for Final Draft hands (D2). */
export const TAB_NEXT: Record<ScriptElement, ScriptElement> = {
  action: "cue",
  cue: "transition",
  transition: "heading",
  heading: "action",
  dialogue: "paren",
  paren: "dialogue",
};
export const SHIFT_TAB_NEXT: Record<ScriptElement, ScriptElement> = {
  action: "heading",
  heading: "transition",
  transition: "cue",
  cue: "action",
  dialogue: "cue",
  paren: "dialogue",
};

export const LINES_PER_PAGE = 55;
/** Each element's left edge in characters from the 1.5in margin, its width, blank lines before. */
export const LAYOUT: Record<ScriptElement, { x: number; width: number; before: number }> = {
  heading: { x: 0, width: 60, before: 1 },
  action: { x: 0, width: 60, before: 1 },
  cue: { x: 22, width: 38, before: 1 },
  paren: { x: 16, width: 19, before: 0 },
  dialogue: { x: 10, width: 35, before: 0 },
  transition: { x: 0, width: 60, before: 1 },
};
/** The fewest lines of action or dialogue left on either side of a page break. */
const MIN_SPLIT = 2;

const HEADING = /^(?:INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E)[.\s]/i;
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
export function classifyLine(text: string, prev: ScriptElement | null): ScriptElement {
  const t = text.trim();
  if (!t) return "action";
  if (FORCED_HEADING.test(t) || HEADING.test(t + " ")) return "heading";
  if (t.startsWith("!")) return "action";
  if (t.startsWith(">") && !t.endsWith("<")) return "transition";
  if ((prev === "cue" || prev === "dialogue" || prev === "paren") && t.startsWith("(") && t.endsWith(")"))
    return "paren";
  if (prev === "cue" || prev === "paren") return "dialogue";
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
  return CAPITALS.includes(element) ? t.toUpperCase() : t;
}

/** Fountain-style text, pasted or imported, as blocks (see the server's `parse_lines`). */
export function parseLines(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let prev: ScriptElement | null = null;
  let blankBefore = true;
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (prev === "cue" || prev === "paren" || prev === "dialogue") prev = "action";
      blankBefore = true;
      return;
    }
    const next = i + 1 < lines.length ? lines[i + 1].trim() : "";
    let el = classifyLine(line, blankBefore ? null : prev);
    if (el === "cue" && !line.trim().startsWith("@") && (!blankBefore || !next)) el = "action";
    if (el === "heading" && !blankBefore && !FORCED_HEADING.test(line.trim())) el = "action";
    const last = blocks[blocks.length - 1];
    if (last && !blankBefore && el === last[0] && (el === "action" || el === "dialogue"))
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
/** Lines from the top of a page; null is a blank line. */
export type Page = (Line | null)[];

/** One block's lines on the page, wrapped and placed. */
export function blockLines(element: ScriptElement, text: string): Line[] {
  const spec = LAYOUT[element] ?? LAYOUT.action;
  const hang = element === "paren" ? 1 : 0;
  return wrap(text, spec.width, hang).map((t, i) => ({
    element,
    text: t,
    x: element === "transition" ? Math.max(0, spec.width - t.length) : spec.x + (i ? hang : 0),
  }));
}

function speechEnd(blocks: Block[], i: number): number {
  let j = i + 1;
  while (j < blocks.length && (blocks[j][0] === "paren" || blocks[j][0] === "dialogue")) j++;
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

function keepWith(blocks: Block[], i: number): number {
  if (i + 1 >= blocks.length) return 0;
  const [element, text] = blocks[i + 1];
  const before = LAYOUT[element].before;
  if (element === "cue") {
    const end = speechEnd(blocks, i + 1);
    const body = blocks.slice(i + 2, end).reduce((n, [e, t]) => n + blockLines(e, t).length, 0);
    return before + 1 + Math.min(body, MIN_SPLIT);
  }
  return before + Math.min(blockLines(element, text).length, MIN_SPLIT);
}

/** Lay the blocks out on pages, the way the PDF prints them (see the server's `paginate`). */
export function paginate(input: Block[], linesPerPage = LINES_PER_PAGE): Page[] {
  const pages: Page[] = [[]];
  const page = () => pages[pages.length - 1];
  const gap = (element: ScriptElement) => (page().length ? LAYOUT[element].before : 0);
  const room = (element: ScriptElement) => linesPerPage - page().length - gap(element);
  const put = (element: ScriptElement, lines: Line[]) => {
    page().push(...Array<null>(gap(element)).fill(null), ...lines);
  };
  const turn = () => {
    if (page().length) pages.push([]);
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
    let head = blockLines("cue", cueText);
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
      put("cue", [...head, ...body.slice(0, split), { element: "more", text: "(MORE)", x: LAYOUT.cue.x }]);
      turn();
      const cue = parseCue(cueText);
      const kept = cue.extensions
        .filter((e) => e.toUpperCase() !== "CONT'D")
        .map((e) => ` (${e})`)
        .join("");
      cueText = `${cue.name}${kept} (CONT'D)`;
      head = blockLines("cue", cueText);
      body = body.slice(split);
    }
  };

  const blocks = input.filter(([, t]) => t.trim());
  for (let i = 0; i < blocks.length;) {
    const [element, text] = blocks[i];
    if (element === "cue") {
      const end = speechEnd(blocks, i);
      speech(
        text,
        blocks.slice(i + 1, end).flatMap(([e, t]) => blockLines(e, t)),
      );
      i = end;
      continue;
    }
    place(element, blockLines(element, text), element === "heading" ? keepWith(blocks, i) : 0);
    i++;
  }
  return pages;
}

/** How many pages the blocks print on (none for nothing). */
export function pageCount(blocks: Block[]): number {
  return blocks.some(([, t]) => t.trim()) ? paginate(blocks).length : 0;
}

/** Lines laid end to end, blank lines included: a scene's length. */
export function sceneLines(blocks: Block[]): number {
  let total = 0;
  for (const [element, text] of blocks) {
    if (!text.trim()) continue;
    total += (total ? (LAYOUT[element] ?? LAYOUT.action).before : 0) + blockLines(element, text).length;
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
