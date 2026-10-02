import type { Note } from "./notes";

/** Planning types (refactor doc 10): the brain dump and open questions. */

export type FiledKind =
  "character" | "place" | "scene" | "question" | "theme" | "logline" | "premise" | "conflict";

/** One piece of the author's brain dump, and what it became once sorted. */
export interface IdeaFragment {
  id: string;
  text: string;
  created_at: string;
  filed: { kind: FiledKind; ref_id: string | null; label: string } | null;
}

/** Something not decided yet: a note of kind "question" (doc 15); done means answered. */
export type Question = Note & { kind: "question" };

export type QuestionSubject =
  { about_type: "character" | "location"; about_id: string } | { node_id: string } | Record<string, never>;
