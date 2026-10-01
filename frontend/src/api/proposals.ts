import { request } from "./request";
import type { ActResult, ProposalsOut } from "../types/proposals";

/** The Proposals inbox (doc 12 P5). Kept out of client.ts (size budget). */
export const proposalsApi = {
  list: (storyId: string) => request<ProposalsOut>(`/stories/${storyId}/proposals`),
  act: (storyId: string, id: string, action: string) =>
    request<ActResult>(`/stories/${storyId}/proposals/${encodeURIComponent(id)}/act`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  decline: (storyId: string, id: string) =>
    request<void>(`/stories/${storyId}/proposals/${encodeURIComponent(id)}/decline`, { method: "POST" }),
  lookAgain: (storyId: string, ai: boolean) =>
    request<ProposalsOut & { job_id: string | null }>(`/stories/${storyId}/proposals/refresh`, {
      method: "POST",
      body: JSON.stringify({ ai }),
    }),
};
