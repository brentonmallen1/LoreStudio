import { request } from "./request";

/** One story's progress for its dashboard card (GET /stories/progress). */
export interface StoryProgress {
  story_id: string;
  word_count: number;
  /** The target's top, in its unit: words for prose, pages for a script (doc 25). */
  target_words: number | null;
  target_unit?: "words" | "pages" | null;
  /** Where the story stands, in that unit. */
  target_current?: number | null;
  pct: number | null;
  last_scene_id: string | null;
  last_scene_title: string | null;
}

export const progressApi = {
  list: () => request<StoryProgress[]>("/stories/progress"),
};
