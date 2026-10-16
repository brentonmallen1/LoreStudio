/**
 * Two takes of a scene, word by word (doc 29 D7): what is the same in both, and what only one
 * has. Compare marks the words only take 1 has and the words only take 2 has; the rest reads
 * plain. Reworking one passage marks that passage alone.
 *
 * A longest common subsequence over words, with paragraph breaks as words of their own so
 * paragraphs line up. The two ends the takes share are taken off first (a new take starts as a
 * copy, so most of it usually is), and the table is built only over what is left. Past
 * `MAX_CELLS` it compares whole paragraphs instead, so two very different long takes stay quick.
 */

/** A run of words on one side: the same in both takes, or only in this one. */
export interface Run {
  text: string;
  only: boolean;
}

/** One side of the comparison: its paragraphs, each a list of runs. */
export type Side = Run[][];

export interface TakeDiff {
  a: Side;
  b: Side;
  /** Passages that differ: runs only one side has, counted once per place they differ. */
  changes: number;
}

/** The table's size limit, in cells: 2,000 words that differ in each take, past what they share. */
export const MAX_CELLS = 4_000_000;

const BREAK = " ";

function words(paragraphs: string[]): string[] {
  const out: string[] = [];
  paragraphs.forEach((p, i) => {
    if (i > 0) out.push(BREAK);
    out.push(...p.split(/\s+/).filter(Boolean));
  });
  return out;
}

type Op = { kind: "same" | "a" | "b"; word: string };

/** The longest common subsequence of `a` and `b` as a list of steps. */
function lcs<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean,
): { kind: "same" | "a" | "b"; i: number; j: number }[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i * width + j] = eq(a[i], b[j])
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const steps: { kind: "same" | "a" | "b"; i: number; j: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) steps.push({ kind: "same", i: i++, j: j++ });
    else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) steps.push({ kind: "a", i: i++, j });
    else steps.push({ kind: "b", i, j: j++ });
  }
  while (i < n) steps.push({ kind: "a", i: i++, j });
  while (j < m) steps.push({ kind: "b", i, j: j++ });
  return steps;
}

/** Word by word, or null when what differs is too long to tabulate. */
function wordOps(a: string[], b: string[]): Op[] | null {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end])
    end++;
  const midA = a.slice(start, a.length - end);
  const midB = b.slice(start, b.length - end);
  if (midA.length * midB.length > MAX_CELLS) return null;
  const head: Op[] = a.slice(0, start).map((word) => ({ kind: "same", word }));
  const tail: Op[] = a.slice(a.length - end).map((word) => ({ kind: "same", word }));
  const middle: Op[] = lcs(midA, midB, (x, y) => x === y).map((s) =>
    s.kind === "same"
      ? { kind: "same", word: midA[s.i] }
      : s.kind === "a"
        ? { kind: "a", word: midA[s.i] }
        : { kind: "b", word: midB[s.j] },
  );
  return [...head, ...middle, ...tail];
}

/** Whole paragraphs compared, for takes too different to compare word by word quickly. */
function paragraphOps(a: string[], b: string[]): Op[] {
  const ops: Op[] = [];
  const steps = lcs(a, b, (x, y) => x === y);
  steps.forEach((s, k) => {
    const para = s.kind === "b" ? b[s.j] : a[s.i];
    if (k > 0) ops.push({ kind: s.kind, word: BREAK });
    for (const word of para.split(/\s+/).filter(Boolean)) ops.push({ kind: s.kind, word });
  });
  return ops;
}

/**
 * Folds a few shared words between two changes into the change, as a reader sees a reworked
 * sentence: "She opened the door on a woman" against "You'll be the keeper, the woman said" is
 * one change, not five with "the" and "woman" left plain between them. A shared stretch goes
 * when it is no longer than the changes either side of it (diff-match-patch's semantic
 * cleanup); a paragraph break never does, so paragraphs stay lined up.
 */
function tidy(ops: Op[]): Op[] {
  type Seg = { same: boolean; ops: Op[] };
  let segs: Seg[] = [];
  for (const op of ops) {
    const same = op.kind === "same";
    const last = segs[segs.length - 1];
    if (last && last.same === same) last.ops.push(op);
    else segs.push({ same, ops: [op] });
  }
  const size = (seg: Seg) =>
    Math.max(seg.ops.filter((o) => o.kind === "a").length, seg.ops.filter((o) => o.kind === "b").length);
  for (let i = 1; i < segs.length - 1; i++) {
    const [before, seg, after] = [segs[i - 1], segs[i], segs[i + 1]];
    if (!seg.same || seg.ops.some((o) => o.word === BREAK)) continue;
    if (seg.ops.length > Math.min(size(before), size(after))) continue;
    const merged: Seg = {
      same: false,
      ops: [
        ...before.ops,
        ...seg.ops.map((o): Op => ({ kind: "a", word: o.word })),
        ...seg.ops.map((o): Op => ({ kind: "b", word: o.word })),
        ...after.ops,
      ],
    };
    segs = [...segs.slice(0, i - 1), merged, ...segs.slice(i + 2)];
    i = Math.max(0, i - 2);
  }
  return segs.flatMap((seg) => seg.ops);
}

/** One side's paragraphs from the steps: its own words and the shared ones, in runs. */
function side(ops: Op[], own: "a" | "b"): Side {
  const paras: Side = [[]];
  for (const op of ops) {
    if (op.kind !== "same" && op.kind !== own) continue;
    if (op.word === BREAK) {
      paras.push([]);
      continue;
    }
    const runs = paras[paras.length - 1];
    const only = op.kind === own;
    const last = runs[runs.length - 1];
    if (last && last.only === only) last.text += ` ${op.word}`;
    else runs.push({ text: last ? ` ${op.word}` : op.word, only });
  }
  // A space between runs belongs to the shared text, so a mark covers words, not the gaps.
  for (const runs of paras)
    for (let i = 1; i < runs.length; i++)
      if (runs[i].only && runs[i].text.startsWith(" ")) {
        runs[i].text = runs[i].text.slice(1);
        runs[i - 1].text += " ";
      }
  return paras.filter((p, i) => p.length > 0 || i === 0);
}

/** How many places the takes part: each stretch of steps that are not shared counts once. */
function places(ops: Op[]): number {
  let n = 0;
  let inside = false;
  for (const op of ops) {
    const differs = op.kind !== "same";
    if (differs && !inside) n++;
    inside = differs;
  }
  return n;
}

/** Compare two takes, each given as its paragraphs' text. */
export function diffTakes(aParas: string[], bParas: string[]): TakeDiff {
  const a = words(aParas);
  const b = words(bParas);
  const ops = tidy(wordOps(a, b) ?? paragraphOps(aParas, bParas));
  return { a: side(ops, "a"), b: side(ops, "b"), changes: places(ops) };
}

/** A take's prose as the reader meets it, paragraph by paragraph (no tags). */
export function paragraphsOf(html: string): string[] {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const blocks = doc.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre");
  const out: string[] = [];
  blocks.forEach((el) => {
    if (el.querySelector("p, li")) return; // a list or quote holding paragraphs: read those
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  });
  return out;
}
