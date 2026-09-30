import { request } from "./request";
import type { SceneCast } from "../types/panel";

/** Who, where and which threads, for every scene at once (doc 11 phase 1). */
export const sceneCastApi = {
  get: (storyId: string) => request<SceneCast>(`/stories/${storyId}/scene-cast`),
};
