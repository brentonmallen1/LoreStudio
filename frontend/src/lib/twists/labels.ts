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
/** Where a twist stands, worked out from its clues and its reveal. "seeding" is said plainly
 *  (doc 30 D6): at least one clue is in a scene, and the reveal is still to come. */
export const STATUSES: { value: TwistStatus; label: string; hint: string }[] = [
  { value: "planned", label: "Planned", hint: "No clue is in a scene yet" },
  { value: "seeding", label: "Clues planted", hint: "A clue is in a scene; the reveal is still to come" },
  { value: "revealed", label: "Revealed", hint: "It has its reveal scene" },
];
export const typeLabel = (t: TwistType) => TYPES.find((x) => x.value === t)?.label ?? t;
export const statusLabel = (s: TwistStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;
export const statusHint = (s: TwistStatus) => STATUSES.find((x) => x.value === s)?.hint;

/** "3 clues planted · 1 not placed": a clue with no scene is not planted yet (it counted). */
export function cluesLine(twist: Pick<Twist, "clues">): string {
  const placed = twist.clues.filter((c) => c.node_id).length;
  const unplaced = twist.clues.length - placed;
  const head = `${placed} ${placed === 1 ? "clue" : "clues"} planted`;
  return unplaced ? `${head} · ${unplaced} not placed` : head;
}
