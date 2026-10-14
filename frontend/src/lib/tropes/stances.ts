import type { TropeStance } from "../../types/tropes";

/**
 * What the author does with a trope (doc 27). The stance is the part a model cannot guess,
 * and the reason a trope is worth recording at all: the definition alone is reference.
 */
export const STANCES: { value: TropeStance; label: string; hint: string }[] = [
  { value: "undecided", label: "Not decided", hint: "You know it is in play; what you do with it can wait" },
  { value: "straight", label: "Played straight", hint: "The story gives the reader what the trope promises" },
  {
    value: "subverted",
    label: "Subverted",
    hint: "It sets up the expectation, then goes somewhere else",
  },
  { value: "inverted", label: "Inverted", hint: "The usual roles or outcome are swapped" },
  { value: "averted", label: "Averted", hint: "Where the reader expects it, it does not happen" },
  {
    value: "deconstructed",
    label: "Deconstructed",
    hint: "It plays out with real consequences, to show what the trope hides",
  },
  { value: "lampshaded", label: "Lampshaded", hint: "The story knows it is a trope and says so" },
];

const BY_VALUE = new Map(STANCES.map((s) => [s.value, s]));

export const stanceLabel = (stance: TropeStance) => BY_VALUE.get(stance)?.label ?? stance;
export const stanceHint = (stance: TropeStance) => BY_VALUE.get(stance)?.hint ?? "";

/** Stances that promise the expectation will be turned: the thread that tracks it should turn. */
export const TURNING: ReadonlySet<TropeStance> = new Set(["subverted", "inverted", "deconstructed"]);
