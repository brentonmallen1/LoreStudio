import { request } from "./request";
import type { CarryCandidate, CarryItem, SequelCreated } from "./series";
import type { StoryFormat } from "../types";

/** Adapting a novel as a script (doc 25, P10): a new story after it in its series. */
export const adaptationApi = {
  /** The novel's whole Lorebook, everything ticked: the script tells the same story. */
  carry: (storyId: string) => request<CarryCandidate[]>(`/stories/${storyId}/adapt/carry`),
  adapt: (
    storyId: string,
    body: { story_format: StoryFormat; title?: string; carry: CarryItem[]; series_name?: string },
  ) =>
    request<SequelCreated>(`/stories/${storyId}/adapt`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
