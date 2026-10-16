import { request } from "./request";
import type { StructureNode } from "../types";

/** Structure calls added after client.ts reached its size budget. */
export const structureApi = {
  /** Lay out an empty story's first outline from its template; says where to write. */
  start: (storyId: string) =>
    request<{ start_node_id: string }>(`/stories/${storyId}/structure/start`, { method: "POST" }),
  /** A chapter's (or an act's) own prose moved into a new first scene named for it; one undo. */
  giveScene: (nodeId: string) =>
    request<StructureNode>(`/structure/${nodeId}/give-scene`, { method: "POST", body: JSON.stringify({}) }),
};
