import { request } from "./request";

/**
 * What a character was present for, and what they were told (doc 06 §6).
 * The interview persona is given exactly this; the drawer shows the author the same list.
 * Kept out of client.ts (size budget).
 */
export interface KnownScene {
  node_id: string;
  title: string;
  /** Why we believe they were there: point of view, speaks in the scene, named in the prose. */
  reasons: string[];
  summary: string | null;
}

export interface CharacterKnowledge {
  as_of_node_id: string | null;
  as_of_title: string | null;
  /** Scenes up to the cutoff, present or not — the denominator behind "3 of 18". */
  scenes_considered: number;
  scenes: KnownScene[];
  facts: { subject: string; detail: string; is_truth: boolean }[];
}

export const knowledgeApi = {
  forCharacter: (characterId: string, asOf?: string | null) =>
    request<CharacterKnowledge>(
      `/characters/${characterId}/knowledge${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`,
    ),
};
