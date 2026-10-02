/** Notes (doc 15): margin notes, questions, to-dos and ideas, one row each. */

export type NoteKind = "note" | "question" | "todo" | "idea";

export interface Note {
  id: string;
  story_id: string;
  kind: NoteKind;
  content: string;
  /** A scene, or the scene a passage is in. */
  node_id: string | null;
  /** The passage, as it read when the note was made; the prose's mark carries the id. */
  anchor: string | null;
  about_type: "character" | "location" | null;
  about_id: string | null;
  /** A question's answer. */
  answer: string;
  /** Answered (a question) or ticked (a to-do). */
  done: boolean;
  /** "editorial-{report id}" for a note an editorial pass wrote. */
  source: string | null;
  category: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  node_title: string | null;
}

export type NoteCreate = Partial<
  Pick<Note, "id" | "kind" | "node_id" | "anchor" | "about_type" | "about_id" | "answer" | "done">
> & { content: string };

export type NoteUpdate = Partial<
  Pick<
    Note,
    "content" | "kind" | "node_id" | "anchor" | "about_type" | "about_id" | "answer" | "done" | "position"
  >
>;

export interface NoteFilter {
  kind?: NoteKind | NoteKind[];
  node_id?: string;
  about_type?: "character" | "location";
  about_id?: string;
  open?: boolean;
}
