import { request } from "./request";
import type { StructureNode } from "../types";

/** Organizing what is written (doc 29 D6): split, join and wrap, each one change ⌘Z takes back. */
export const organizeApi = {
  /** The scene keeps `content`; a new scene after it, named `title`, takes `new_content`. */
  split: (
    nodeId: string,
    body: { content: string; new_content: string; title?: string; expected_updated_at?: string },
  ) => request<StructureNode>(`/structure/${nodeId}/split`, { method: "POST", body: JSON.stringify(body) }),
  /** The scene joined with the next one in its chapter; returns the joined scene. */
  mergeNext: (nodeId: string, expected?: string) =>
    request<StructureNode>(`/structure/${nodeId}/merge-next`, {
      method: "POST",
      body: JSON.stringify({ expected_updated_at: expected }),
    }),
  /** Scenes next to each other wrapped in a new chapter; returns the chapters made. */
  wrap: (storyId: string, nodeIds: string[], title: string) =>
    request<StructureNode[]>(`/stories/${storyId}/structure/wrap`, {
      method: "POST",
      body: JSON.stringify({ node_ids: nodeIds, title }),
    }),
};
