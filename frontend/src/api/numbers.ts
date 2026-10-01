import type { StoryNumbers } from "../types/numbers";
import { request } from "./request";

export const numbersApi = {
  get: (storyId: string) => request<StoryNumbers>(`/stories/${storyId}/numbers`),
};
