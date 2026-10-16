import { request } from "./request";

/**
 * What a kept answer can be about: a row of a Lorebook or Promises kind (A6), a scene or
 * section ("node"), an image, an outline, or the story itself (A7).
 */
export type SubjectType =
  | "character"
  | "location"
  | "culture"
  | "world_system"
  | "historical_event"
  | "calendar"
  | "location_travel"
  | "plot_thread"
  | "twist"
  | "node"
  | "image"
  | "outline"
  | "story";

/** A one-shot Assistant answer kept on the sheet it was asked from (A6). */
export interface AssistantResult {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  /** The gateway feature that answered (services/llm/features.py). */
  feature: string;
  heading: string;
  data: Record<string, unknown>;
  /** The call that made it, for "what was sent". */
  ai_call_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export const assistantResultsApi = {
  /**
   * A thing's kept answers, the newest first; with no id, every answer about a thing of that
   * type (the Compendium's images, in one call). Running a feature writes them.
   */
  list: (storyId: string, subjectType: SubjectType, subjectId?: string) =>
    request<AssistantResult[]>(
      `/stories/${storyId}/assistant-results?subject_type=${subjectType}` +
        (subjectId ? `&subject_id=${encodeURIComponent(subjectId)}` : ""),
    ),
  clear: (storyId: string, id: string) =>
    request<void>(`/stories/${storyId}/assistant-results/${id}`, { method: "DELETE" }),
};
