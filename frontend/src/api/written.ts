import { request } from "./request";
import type { SplitOffer, WrittenOut } from "../types/written";

/** What you've written (doc 29 D6). Reading asks no model; "Not now" is a change ⌘Z takes back. */
export const writtenApi = {
  get: (storyId: string) => request<WrittenOut>(`/stories/${storyId}/written`),
  splitOffer: (nodeId: string) => request<SplitOffer | null>(`/structure/${nodeId}/split-offer`),
  notNow: (storyId: string, key: string) =>
    request<void>(`/stories/${storyId}/written/not-now`, { method: "POST", body: JSON.stringify({ key }) }),
};
