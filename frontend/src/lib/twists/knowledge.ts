/** What the reader knows: its kinds and a blank draft (doc 18). */
import type { KnowledgeType, ReaderKnowledgeEvent } from "../../types";

export const KNOWLEDGE_TYPE_META: Record<KnowledgeType, { label: string; color: string; hint: string }> = {
  truth_revealed: { label: "Truth revealed", color: "truth", hint: "The reader learns something true" },
  misdirection_planted: {
    label: "Misdirection",
    color: "misdirect",
    hint: "The reader is led to believe something false",
  },
  clue_planted: { label: "Clue planted", color: "clue", hint: "A hint the reader may or may not catch" },
  character_learns: { label: "A character learns", color: "char", hint: "Someone in the story finds out" },
  reader_only: {
    label: "Only the reader knows",
    color: "reader",
    hint: "The reader knows what the characters don't",
  },
};

export const KNOWLEDGE_TYPES = Object.keys(KNOWLEDGE_TYPE_META) as KnowledgeType[];

export type KnowledgeDraft = Pick<
  ReaderKnowledgeEvent,
  | "subject"
  | "detail"
  | "knowledge_type"
  | "reader_knows"
  | "is_truth"
  | "characters_who_know"
  | "node_id"
  | "twist_id"
>;

export function emptyDraft(nodeId: string | null): KnowledgeDraft {
  return {
    subject: "",
    detail: "",
    knowledge_type: "truth_revealed",
    reader_knows: true,
    is_truth: true,
    characters_who_know: [],
    node_id: nodeId,
    twist_id: null,
  };
}

/** Dramatic irony: the reader knows what the people in the story don't (doc 18; it was "no one
 * listed", which caught events nobody had filled in and missed the seeded one). */
export function isIrony(e: ReaderKnowledgeEvent): boolean {
  return e.knowledge_type === "reader_only";
}
