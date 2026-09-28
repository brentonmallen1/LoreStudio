import { request } from "./request";

/** Structure calls added after client.ts reached its size budget. */
export const structureApi = {
  /** Lay out an empty story's first outline from its template; says where to write. */
  start: (storyId: string) =>
    request<{ start_node_id: string }>(`/stories/${storyId}/structure/start`, { method: "POST" }),
};
