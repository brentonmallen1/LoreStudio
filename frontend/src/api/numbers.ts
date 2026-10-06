import type { AIJob } from "./jobs";
import type { Reading, ReadingsList, StoryNumbers } from "../types/numbers";
import { request } from "./request";

export const numbersApi = {
  get: (storyId: string) => request<StoryNumbers>(`/stories/${storyId}/numbers`),
  /** The story's readings, oldest first (doc 19). */
  readings: (storyId: string) => request<ReadingsList>(`/stories/${storyId}/numbers/readings`),
  reading: (storyId: string, readingId: string) =>
    request<Reading>(`/stories/${storyId}/numbers/readings/${readingId}`),
  /** Measure now: taken on the server after this answers. */
  measure: (storyId: string) =>
    request<{ queued: boolean }>(`/stories/${storyId}/numbers/readings`, { method: "POST" }),
  /** Measure the earlier versions that have no reading, as a job. */
  backfill: (storyId: string) =>
    request<AIJob>(`/stories/${storyId}/numbers/readings/backfill`, { method: "POST" }),
};
