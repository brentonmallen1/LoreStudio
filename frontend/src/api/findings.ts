import { request } from "./request";
import type { FindingsOut } from "../types/findings";

/** The findings feed (doc 12 P3). Kept out of client.ts (size budget). */
export const findingsApi = {
  list: (storyId: string) => request<FindingsOut>(`/stories/${storyId}/findings`),
  runLocal: (storyId: string) =>
    request<FindingsOut>(`/stories/${storyId}/findings/run-local`, { method: "POST" }),
  dismiss: (storyId: string, id: string) =>
    request<void>(`/stories/${storyId}/findings/${id}/dismiss`, { method: "POST" }),
  restore: (storyId: string, id: string) =>
    request<void>(`/stories/${storyId}/findings/${id}/dismiss`, { method: "DELETE" }),
  fix: (storyId: string, id: string) =>
    request<{ node_id: string; replaced: number }>(`/stories/${storyId}/findings/${id}/fix`, {
      method: "POST",
    }),
};
