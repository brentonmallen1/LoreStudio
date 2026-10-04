import type { Twist } from "../../types";

const SOFT = new Set(["subtle", "hidden"]);
const COUNT = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const count = (n: number) => COUNT[n] ?? String(n);

/**
 * Is the twist fair (doc 18 C5)? Could a careful reader get there before the reveal? Read from
 * the clues toward the truth that land before the reveal and how loud each is. Advice, not a
 * verdict: a deliberate cheat stays the author's call.
 */
export function fairPlay(twist: Twist, index: Map<string, number>): { line: string; advice: string } {
  const reveal = twist.revealed_at_node_id ? index.get(twist.revealed_at_node_id) : undefined;
  const placed = twist.clues.filter((c) => c.node_id && index.has(c.node_id) && c.points_to === "truth");
  if (reveal === undefined) {
    return {
      line: `${count(placed.length)} ${placed.length === 1 ? "clue points" : "clues point"} to the truth so far.`,
      advice:
        "Choose the scene that reveals it, and this says whether a careful reader could get there first.",
    };
  }
  const before = placed.filter((c) => index.get(c.node_id!)! < reveal);
  if (before.length === 0) {
    return {
      line: "No clue points to the truth before the reveal.",
      advice: "One clue a careful reader could catch makes the reveal feel earned rather than sprung.",
    };
  }
  const soft = before.filter((c) => SOFT.has(c.subtlety)).length;
  const kinds = [...new Set(before.map((c) => c.subtlety))].join(" and ");
  const head = `${count(before.length)} ${before.length === 1 ? "clue points" : "clues point"} to the truth before the reveal (${kinds}).`;
  if (soft === before.length) {
    return {
      line: `${head} A careful reader could get there; most won't.`,
      advice: "One more, a little plainer, would make the reveal feel earned.",
    };
  }
  if (before.every((c) => c.subtlety === "obvious")) {
    return {
      line: `${head} Most readers will see it coming.`,
      advice: "Quieter clues, or a stronger misdirection, keep the surprise.",
    };
  }
  return { line: `${head} Fair, and not obvious.`, advice: "" };
}

/** Where the misdirection is planted, and whether anything keeps it alive up to the reveal. */
export function misdirectionLine(
  twist: Twist,
  index: Map<string, number>,
  title: (id: string) => string,
): string {
  const away = twist.clues
    .filter((c) => c.node_id && index.has(c.node_id) && c.points_to === "misdirection")
    .sort((a, b) => index.get(a.node_id!)! - index.get(b.node_id!)!);
  if (away.length === 0)
    return "No clue points away from the truth yet. A false trail makes the reveal land harder.";
  const scenes = [...new Set(away.map((c) => title(c.node_id!)))];
  const where =
    scenes.length === 1 ? scenes[0] : `${scenes.slice(0, -1).join(", ")} and ${scenes[scenes.length - 1]}`;
  const head = `${count(away.length)} ${away.length === 1 ? "clue points" : "clues point"} away, in ${where}.`;
  const reveal = twist.revealed_at_node_id ? index.get(twist.revealed_at_node_id) : undefined;
  const last = away[away.length - 1];
  if (reveal !== undefined && reveal - index.get(last.node_id!)! > 2) {
    return `${head} Nothing keeps the false idea alive after ${title(last.node_id!)}.`;
  }
  return head;
}
