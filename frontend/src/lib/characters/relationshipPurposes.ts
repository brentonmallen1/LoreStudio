/**
 * What a relationship can do for the story (doc 30 D6), each in plain words with a line of
 * what it means. The stored value is the slug; a purpose the writer typed has no entry and
 * shows as typed.
 */
export interface RelationshipPurpose {
  value: string;
  label: string;
  hint: string;
}

export const RELATIONSHIP_PURPOSES: RelationshipPurpose[] = [
  {
    value: "conflict-driver",
    label: "Drives conflict",
    hint: "What they want clashes, so their scenes spark.",
  },
  { value: "ally", label: "Ally", hint: "Stands with them and helps toward what they want." },
  { value: "foil", label: "Foil", hint: "Their differences show each of them more clearly." },
  {
    value: "growth-catalyst",
    label: "Pushes them to change",
    hint: "Being near them forces a change or a reckoning.",
  },
  {
    value: "emotional-anchor",
    label: "Emotional anchor",
    hint: "Someone to hold on to; the story's feeling rests here.",
  },
  {
    value: "twist-setup",
    label: "Sets up a twist",
    hint: "The bond hides something the reader learns later.",
  },
  { value: "comic-relief", label: "Comic relief", hint: "Lightens the story between heavier scenes." },
  {
    value: "exposition-vehicle",
    label: "Carries information",
    hint: "Gives a natural reason for things to be explained.",
  },
  { value: "obstacle", label: "Obstacle", hint: "Stands in the way, whether they mean to or not." },
  { value: "mirror", label: "Mirror", hint: "Shows them who they could become, for better or worse." },
  { value: "wisdom-source", label: "Source of advice", hint: "Knows or has lived what they need to learn." },
  {
    value: "past-connection",
    label: "Tie to the past",
    hint: "Brings back history they can't leave behind.",
  },
  {
    value: "structure-provider",
    label: "Marks the turns",
    hint: "Their meetings fall at the story's turning points.",
  },
];

/** A purpose's plain label, or the words the writer typed. */
export function purposeLabel(value: string): string {
  return RELATIONSHIP_PURPOSES.find((p) => p.value === value)?.label ?? value;
}

export const purposeHint = (value: string) => RELATIONSHIP_PURPOSES.find((p) => p.value === value)?.hint;
