/**
 * Setups and payoffs (doc 18 C3): every scene link, read from the earlier scene to the later
 * one, so foreshadowing, callbacks and bookends all say what sets up what.
 */
export interface SetupType {
  value: string;
  label: string;
  hint: string;
  /** How the link reads as a sentence: `{first} {verb} {second}`. */
  verb: string;
  /** Read later scene first ("The Gap calls back to The Light"). */
  laterFirst: boolean;
}

export const SETUP_TYPES: SetupType[] = [
  {
    value: "foreshadowing",
    label: "Foreshadows",
    hint: "An early hint at something to come",
    verb: "foreshadows",
    laterFirst: false,
  },
  {
    value: "callback",
    label: "Called back",
    hint: "A later scene returns to an earlier moment",
    verb: "calls back to",
    laterFirst: true,
  },
  {
    value: "causes",
    label: "Leads to",
    hint: "What happens in one makes the other happen",
    verb: "leads to",
    laterFirst: false,
  },
  {
    value: "parallel",
    label: "Parallels",
    hint: "Two scenes that mirror each other, like bookends",
    verb: "mirrors",
    laterFirst: false,
  },
  {
    value: "contrast",
    label: "Contrasts",
    hint: "Two scenes set side by side to show a difference",
    verb: "contrasts with",
    laterFirst: false,
  },
  {
    value: "echoes",
    label: "Echoes",
    hint: "A later scene repeats an image, a line or a feeling",
    verb: "echoes",
    laterFirst: true,
  },
];

export const setupType = (value: string): SetupType =>
  SETUP_TYPES.find((t) => t.value === value) ?? SETUP_TYPES[SETUP_TYPES.length - 1];

/** The link as a sentence, from the earlier scene's title and the later one's. */
export function setupSentence(value: string, earlier: string, later: string): string {
  const t = setupType(value);
  return t.laterFirst ? `${later} ${t.verb} ${earlier}` : `${earlier} ${t.verb} ${later}`;
}
