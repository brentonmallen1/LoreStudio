import type { NoteKind } from "../../types/notes";

/** What each kind is called in the interface (doc 15). */
export const KIND_LABEL: Record<NoteKind, string> = {
  note: "Note",
  question: "Question",
  todo: "To-do",
  idea: "Idea",
};
