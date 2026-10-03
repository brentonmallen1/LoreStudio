/** Twist vocabulary, in one place (doc 18): the Lorebook sheet and the panel tab both say it. */
import type { Twist, TwistStatus, TwistType } from "../../types";

export const TYPES: { value: TwistType; label: string; hint: string }[] = [
  { value: "reveal", label: "Reveal", hint: "Hidden information is exposed" },
  { value: "reversal", label: "Reversal", hint: "Expectations are subverted" },
  { value: "identity", label: "Identity", hint: "Who someone really is" },
  {
    value: "unreliable_narrator",
    label: "Unreliable narrator",
    hint: "The narrator has been deceiving the reader",
  },
  { value: "red_herring", label: "Red herring", hint: "A deliberate false lead" },
];
export const STATUSES: { value: TwistStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "seeding", label: "Seeding" },
  { value: "revealed", label: "Revealed" },
];
export const typeLabel = (t: TwistType) => TYPES.find((x) => x.value === t)?.label ?? t;
export const statusLabel = (s: TwistStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;

/** "3 clues planted · 1 not placed": a clue with no scene is not planted yet (it counted). */
export function cluesLine(twist: Pick<Twist, "clues">): string {
  const placed = twist.clues.filter((c) => c.node_id).length;
  const unplaced = twist.clues.length - placed;
  const head = `${placed} ${placed === 1 ? "clue" : "clues"} planted`;
  return unplaced ? `${head} · ${unplaced} not placed` : head;
}
