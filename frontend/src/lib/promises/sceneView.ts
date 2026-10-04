import { roleLabel } from "../threads/roles";
import type { Promises, PromiseThread } from "../../types/promises";

/** A note's first sentence or so, for a one-line reminder. */
function short(note: string): string {
  const line = note
    .split("\n")[0]
    .trim()
    .replace(/[.!?]$/, "");
  if (line.length <= 80) return line;
  return `${line.slice(0, 80).replace(/\s+\S*$/, "")}…`;
}

export interface OpenThread {
  thread: PromiseThread;
  /** "Open since The Light. Last moved in The Gap: six months of entries, gone." */
  line: string;
}

/**
 * The threads open at a scene (doc 18 C6): opened at or before it, not closed before it, and
 * not doing anything in the scene itself (those are listed as what the scene does).
 */
export function openAt(data: Promises, index: number): OpenThread[] {
  const title = (i: number) => data.scenes[i]?.title ?? "a scene";
  const out: OpenThread[] = [];
  for (const t of data.threads) {
    if (t.status === "set_aside" || t.beats.length === 0) continue;
    if (t.beats.some((b) => b.index === index)) continue;
    const first = t.beats[0];
    const closes = t.beats.find((b) => b.role === "closes");
    if (first.index > index || (closes && closes.index < index)) continue;
    const before = t.beats.filter((b) => b.index < index);
    const last = before[before.length - 1];
    const since = `Open since ${title(first.index)}.`;
    const moved =
      last && last !== first
        ? ` Last in ${title(last.index)}: ${short(last.note) || roleLabel(last.role)}.`
        : "";
    out.push({ thread: t, line: since + moved });
  }
  return out;
}

/** What the reader holds by the end of a scene: what they learned, the clues seen, what was overturned. */
export function readerBy(data: Promises, index: number) {
  const rows = data.reader.filter((r) => r.index <= index);
  const learned = rows.reduce((n, r) => n + r.learns.length, 0);
  const clues = data.twists.reduce(
    (n, tw) => n + tw.clues.filter((c) => c.index !== null && c.index <= index).length,
    0,
  );
  const overturned = rows.flatMap((r) => r.believes.filter((b) => b.over).map((b) => b.text));
  const only = rows.flatMap((r) => r.only.map((o) => o.text));
  return { learned, clues, overturned, only };
}
