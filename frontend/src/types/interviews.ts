/**
 * Character interviews and panels: the conversation, and how much of the story the
 * character may draw on. Split out of types/index.ts, which is on the size debt list.
 */

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * How much of the story a character may draw on in an interview (doc 06 §6).
 *
 * `present` is not omniscience: it is every scene they were in, across the manuscript.
 * `omniscient` is the author's hypothetical — the whole book, scenes they were never in
 * included, with the character told plainly that they did not live them.
 */
export type KnowledgeScope = "profile" | "present" | "as_of" | "omniscient";

/** Fields an interview can be re-pointed at after it is created. */
export interface InterviewUpdate {
  interview_notes?: string;
  title?: string;
  knowledge_scope?: KnowledgeScope;
  context_node_id?: string | null;
}

export interface Interview {
  id: string;
  character_id: string;
  title: string;
  context_node_id: string | null;
  knowledge_scope: KnowledgeScope;
  messages: InterviewMessage[];
  interview_notes: string;
  compacted_summary: string | null;
  compaction_count: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterJourney {
  summary: string;
  is_stale: boolean;
  scene_count: number;
  generated_at: string | null;
}

export interface InterviewSummary {
  id: string;
  character_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}
