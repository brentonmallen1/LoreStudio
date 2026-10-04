import type { PlotThread } from "../../types";
import { isTry } from "./roles";

/** Where a thread opens and closes, as scene indexes in reading order; null when either is unset. */
export function spanOf(t: PlotThread, index: Map<string, number>): [number, number] | null {
  const o = t.opens_at_node_id ? index.get(t.opens_at_node_id) : undefined;
  const c = t.closes_at_node_id ? index.get(t.closes_at_node_id) : undefined;
  return o === undefined || c === undefined || c < o ? null : [o, c];
}

/**
 * How a thread sits with the others (doc 18 C5): which it nests inside, which nest inside it,
 * which it crosses (opens inside another and closes after it), and which share its span.
 * Threads that follow one another are not mentioned.
 */
export function relations(thread: PlotThread, threads: PlotThread[], index: Map<string, number>): string[] {
  const me = spanOf(thread, index);
  if (!me) return [];
  const [a0, a1] = me;
  const same: string[] = [];
  const inside: string[] = [];
  const holds: string[] = [];
  const crosses: string[] = [];
  for (const other of threads) {
    if (other.id === thread.id || other.status === "set_aside") continue;
    const span = spanOf(other, index);
    if (!span) continue;
    const [b0, b1] = span;
    if (a0 === b0 && a1 === b1) same.push(other.name);
    else if (b0 <= a0 && a1 <= b1) inside.push(other.name);
    else if (a0 <= b0 && b1 <= a1) holds.push(other.name);
    else if ((a0 < b0 && b0 < a1 && a1 < b1) || (b0 < a0 && a0 < b1 && b1 < a1)) crosses.push(other.name);
  }
  const list = (names: string[]) =>
    names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const out: string[] = [];
  if (same.length) out.push(`Opens and closes with ${list(same)}.`);
  if (inside.length) out.push(`Sits inside ${list(inside)}.`);
  if (holds.length)
    out.push(
      `${list(holds)} ${holds.length === 1 ? "opens and closes" : "open and close"} inside it, so they nest.`,
    );
  if (crosses.length)
    out.push(
      `Crosses ${list(crosses)}: one opens inside the other and closes after it. Threads usually close in the reverse order they opened.`,
    );
  return out;
}

const COUNT = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TRY_WORDS: Record<string, string> = {
  fails: "fails",
  fails_worse: "fails worse",
  costs: "succeeds at a cost",
  succeeds: "succeeds",
};

/** "Three tries: one fails, one fails worse, one succeeds at a cost." in reading order. */
export function triesLine(thread: PlotThread, index: Map<string, number>): string {
  const tries = thread.appearances
    .filter((a) => isTry(a.role))
    .sort((a, b) => (index.get(a.node_id) ?? 0) - (index.get(b.node_id) ?? 0));
  if (tries.length === 0) return "No tries marked yet. A try that fails raises the stakes before the end.";
  const n = COUNT[tries.length] ?? String(tries.length);
  const word = tries.length === 1 ? "try" : "tries";
  return `${n} ${word}: ${tries.map((a) => `one ${TRY_WORDS[a.role]}`).join(", ")}.`;
}
