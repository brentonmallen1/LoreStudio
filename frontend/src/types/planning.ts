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

/** Something not decided yet. Shares the TODO table (kind "question"); done means answered. */
export interface Question {
  id: string;
  story_id: string;
  kind: "question";
  content: string;
  answer: string;
  done: boolean;
  about_type: "character" | "location" | null;
  about_id: string | null;
  /** A question about a scene. */
  node_id: string | null;
  node_title: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type QuestionSubject =
  { about_type: "character" | "location"; about_id: string } | { node_id: string } | Record<string, never>;
