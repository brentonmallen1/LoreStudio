import { request } from "./request";
import type { SceneTake, TakesOut } from "../types/takes";

/** Scene takes (doc 29 D7). Each change but typing is one step ⌘Z takes back; every answer is
 * the scene's takes as they now stand. */
export const takesApi = {
  list: (nodeId: string) => request<TakesOut>(`/structure/${nodeId}/takes`),
  /** A copy of the open take (the scene's prose, the first time), opened. */
  tryAnother: (nodeId: string) => request<TakesOut>(`/structure/${nodeId}/takes`, { method: "POST" }),
  open: (takeId: string) => request<TakesOut>(`/takes/${takeId}/open`, { method: "POST" }),
  /** Make it the take that counts: its words become the scene's prose. */
  use: (takeId: string) => request<TakesOut>(`/takes/${takeId}/use`, { method: "POST" }),
  rename: (takeId: string, label: string) =>
    request<TakesOut>(`/takes/${takeId}`, { method: "PATCH", body: JSON.stringify({ label }) }),
  /** Autosave for a take that does not count; the one that counts saves as the scene. */
  write: (takeId: string, body: { content: string; word_count: number }) =>
    request<SceneTake>(`/takes/${takeId}/content`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (takeId: string) => request<TakesOut>(`/takes/${takeId}`, { method: "DELETE" }),
};
