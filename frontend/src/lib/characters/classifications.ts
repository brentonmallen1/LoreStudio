/**
 * The ways a character can be classified on the character form: a role, a type and two
 * archetypes, each with what it means. Optional lenses, not boxes (doc 30 D6).
 */
export interface ClassificationOption {
  value: string;
  label: string;
  description: string;
  sub?: string; // e.g. "Strengths: …" or "Weaknesses: …"
}

export const ROLES: ClassificationOption[] = [
  {
    value: "protagonist",
    label: "Protagonist",
    description: "Main character: the narrative follows their choices and growth.",
  },
  {
    value: "deuteragonist",
    label: "Deuteragonist",
    description: "Secondary lead: a close companion or ally whose path intertwines with the protagonist's.",
    sub: "e.g. Ron Weasley, Samwise Gamgee",
  },
  {
    value: "antagonist",
    label: "Antagonist",
    description: "Opposes the protagonist through villainy, rivalry, or conflicting values.",
  },
  {
    value: "love_interest",
    label: "Love interest",
    description:
      "A character whose romantic or emotional connection to the protagonist adds stakes and complexity.",
  },
  {
    value: "confidant",
    label: "Confidant",
    description: "The character the protagonist trusts with their doubts and fears; they carry secrets.",
  },
  {
    value: "foil",
    label: "Foil",
    description: "Contrasts the protagonist's qualities to highlight them: the cautious to their bold.",
  },
  {
    value: "tertiary",
    label: "Tertiary",
    description: "Background character who populates the world: real, but not central to the main plot.",
  },
];

export const CHARACTER_TYPES: ClassificationOption[] = [
  {
    value: "round",
    label: "Round",
    description: "Complex and multi-dimensional: contradictory, capable of surprising even themselves.",
  },
  {
    value: "flat",
    label: "Flat",
    description: "Defined by one or two clear traits: reliable and consistent, but not deeply layered.",
  },
  {
    value: "dynamic",
    label: "Dynamic",
    description: "Changes or grows throughout the story; the arc is built into who they are.",
  },
  {
    value: "static",
    label: "Static",
    description: "Fundamentally unchanged: a fixed point that can be an anchor or a limitation.",
  },
  {
    value: "stock",
    label: "Stock",
    description: "A recognizable type (the wise elder, the loyal friend), shaped by convention.",
  },
  {
    value: "symbolic",
    label: "Symbolic",
    description: "Represents something larger (an idea, a theme, a force), more than a realistic individual.",
  },
];

export const JUNGIAN_ARCHETYPES: ClassificationOption[] = [
  {
    value: "lover",
    label: "Lover",
    description: "Guided by the heart: passionate, humane, and connected.",
    sub: "Strengths: humanism, passion · Weaknesses: naivety, irrationality",
  },
  {
    value: "hero",
    label: "Hero",
    description: "Rises to meet challenges with courage and perseverance.",
    sub: "Strengths: courage, honor · Weaknesses: overconfidence, hubris",
  },
  {
    value: "magician",
    label: "Magician",
    description: "Masters the underlying forces: knowledge as power.",
    sub: "Strengths: omniscience, discipline · Weaknesses: corruptibility, arrogance",
  },
  {
    value: "outlaw",
    label: "Outlaw",
    description: "Defies convention: independent, skeptical, willing to break rules.",
    sub: "Strengths: independence, skepticism · Weaknesses: self-involvement, criminality",
  },
  {
    value: "explorer",
    label: "Explorer",
    description: "Driven to discover: restless, curious, always seeking what's next.",
    sub: "Strengths: curiosity, self-improvement · Weaknesses: restlessness, never settled",
  },
  {
    value: "sage",
    label: "Sage",
    description: "Guided by wisdom and long experience: insightful but cautious.",
    sub: "Strengths: wisdom, insight · Weaknesses: hesitant to act, overly cautious",
  },
  {
    value: "innocent",
    label: "Innocent",
    description: "Morally pure: sincerely good, but vulnerable and naive.",
    sub: "Strengths: kindness, sincerity · Weaknesses: vulnerability, lack of skill",
  },
  {
    value: "creator",
    label: "Creator",
    description: "A driven visionary: builds things, holds a strong conviction.",
    sub: "Strengths: creativity, willpower · Weaknesses: self-involved, single-minded",
  },
  {
    value: "ruler",
    label: "Ruler",
    description: "Carries authority: natural command, status, and resources.",
    sub: "Strengths: power, status · Weaknesses: aloof, perceived as out of touch",
  },
  {
    value: "caregiver",
    label: "Caregiver",
    description: "Lives in service to others: selfless, loyal, and reliable.",
    sub: "Strengths: selflessness, loyalty · Weaknesses: lacks ambition, may lack self-worth",
  },
  {
    value: "everyman",
    label: "Everyman",
    description: "Grounded and relatable: no special powers, just ordinary humanity.",
    sub: "Strengths: relatable, grounded · Weaknesses: unprepared for the extraordinary",
  },
  {
    value: "jester",
    label: "Jester",
    description: "Finds truth through humor: disarming, funny, and often perceptive.",
    sub: "Strengths: insight, disarming · Weaknesses: obnoxious, avoids real feeling",
  },
];

export const NARRATIVE_ARCHETYPES: ClassificationOption[] = [
  {
    value: "hero",
    label: "Hero",
    description: "Central figure on a transformative journey; the story follows their arc.",
  },
  {
    value: "mentor",
    label: "Mentor",
    description: "Wise guide who prepares the hero with knowledge, challenge, or example.",
  },
  {
    value: "threshold_guardian",
    label: "Threshold guardian",
    description: "Tests the hero before they can progress. Ensures only the ready pass.",
  },
  {
    value: "herald",
    label: "Herald",
    description: "Announces that change is coming; their arrival sets the story in motion.",
  },
  {
    value: "shapeshifter",
    label: "Shapeshifter",
    description: "Uncertain loyalty: keeps the hero and reader guessing about their allegiance.",
  },
  {
    value: "shadow",
    label: "Shadow",
    description: "Dark mirror: represents what the hero fears becoming; the antagonist.",
  },
  {
    value: "trickster",
    label: "Trickster",
    description: "Disrupts through humor or chaos. Often reveals uncomfortable truths.",
  },
  {
    value: "ally",
    label: "Ally",
    description: "Walks alongside the hero: loyal, capable, essential to the journey.",
  },
];
