/** Story identity's groups (A4), in order: the h2 ids the section rail and "Jump to" go to. */
export const IDENTITY_SECTIONS = [
  { id: "identity-foundation", text: "Foundation", hint: "What is this story?" },
  { id: "identity-voice", text: "Voice", hint: "How is it told?" },
  { id: "identity-form", text: "Form", hint: "What shape does it take?" },
  { id: "identity-substance", text: "Substance", hint: "What's it really about?" },
  { id: "identity-compass", text: "Compass", hint: "Where are you going?" },
  { id: "identity-summaries", text: "Summaries", hint: "The story so far" },
] as const;

export type SectionId = (typeof IDENTITY_SECTIONS)[number]["id"];
