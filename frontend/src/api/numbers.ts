import type { AIJob } from "./jobs";
import type { Reading, ReadingsList, StoryNumbers, Talk } from "../types/numbers";
import { request } from "./request";

const groupQuery = (group: string[] | null) =>
  group === null
    ? ""
    : `?${group.length ? group.map((g) => `group=${encodeURIComponent(g)}`).join("&") : "group="}`;

export const numbersApi = {
  /** Talking to each other (doc 20 P7); null asks for the values that say "woman". */
  talk: (storyId: string, group: string[] | null) =>
    request<Talk>(`/stories/${storyId}/numbers/talk${groupQuery(group)}`),
  /** Studio: what each of those conversations is about. */
  talkSubjects: (storyId: string, group: string[] | null) =>
    request<Talk>(`/stories/${storyId}/numbers/talk/subjects`, {
      method: "POST",
      body: JSON.stringify({ group }),
    }),
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
