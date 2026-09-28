import { request } from "./request";

/** One story's progress for its dashboard card (GET /stories/progress). */
export interface StoryProgress {
  story_id: string;
  word_count: number;
  target_words: number | null;
  pct: number | null;
  last_scene_id: string | null;
  last_scene_title: string | null;
}

export const progressApi = {
  list: () => request<StoryProgress[]>("/stories/progress"),
};
