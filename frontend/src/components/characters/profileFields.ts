/**
 * The Profile section's text fields, in order. One list drives the fields, their labels
 * and placeholders, and the local copy the sheet edits, so adding a field is one line.
 */
export const PROFILE_FIELDS = [
  { key: "personality", label: "Personality", placeholder: "How they come across, and what is underneath…" },
  { key: "motivation", label: "Motivation", placeholder: "What they want, and why…" },
  { key: "background", label: "Background", placeholder: "Where they come from…" },
  { key: "appearance", label: "Appearance", placeholder: "What someone notices first…" },
  { key: "flaws", label: "Flaws", placeholder: "What gets in their way — the fault they cannot see…" },
  { key: "quirks", label: "Quirks", placeholder: "Habits and tics that make them particular…" },
  {
    key: "speech_patterns",
    label: "Speech patterns",
    placeholder: "How they talk: rhythm, favourite words, what they never say…",
  },
  { key: "arc_notes", label: "Arc Notes", placeholder: "Where they start, where they end…" },
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELDS)[number]["key"];
