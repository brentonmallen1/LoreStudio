import { request } from "./request";
import type * as T from "../types";

/** Threads and twists: the promises a story makes (doc 18). Spread into `api`. */
export const promisesApi = {
  /** Every promise in reading order: threads, twists, setups, the reader, the checks (doc 18 C2). */
  getPromises: (storyId: string) =>
    request<import("../types/promises").Promises>(`/stories/${storyId}/promises`),
  // Plot Threads
  listThreads: (storyId: string) => request<T.PlotThread[]>(`/stories/${storyId}/threads`),
  createThread: (
    storyId: string,
    data: { name: string; description?: string; color_slot?: number; mice_type?: string | null },
  ) =>
    request<T.PlotThread>(`/stories/${storyId}/threads`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateThread: (
    threadId: string,
    data: Partial<Pick<T.PlotThread, "name" | "description" | "color_slot" | "mice_type" | "set_aside">>,
  ) =>
    request<T.PlotThread>(`/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteThread: (threadId: string) => request<void>(`/threads/${threadId}`, { method: "DELETE" }),
  /** Put a scene on the thread, saying what it does there; a scene already on it takes the role. */
  addThreadAppearance: (
    threadId: string,
    nodeId: string,
    opts: { role?: T.ThreadRole; note?: string } = {},
  ) =>
    request<T.PlotThreadAppearance>(`/threads/${threadId}/appearances`, {
      method: "POST",
      body: JSON.stringify({ node_id: nodeId, role: opts.role ?? "moves", note: opts.note ?? "" }),
    }),
  updateThreadAppearance: (threadId: string, nodeId: string, data: { role?: T.ThreadRole; note?: string }) =>
    request<T.PlotThreadAppearance>(`/threads/${threadId}/appearances/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  removeThreadAppearance: (threadId: string, nodeId: string) =>
    request<void>(`/threads/${threadId}/appearances/${nodeId}`, { method: "DELETE" }),
  analyzeThread: (threadId: string) =>
    request<T.StructuredResult>(`/threads/${threadId}/analyze`, { method: "POST" }),

  // Twists
  listTwists: (storyId: string) => request<T.Twist[]>(`/stories/${storyId}/twists`),
  createTwist: (storyId: string, data: { name: string; twist_type?: string; color_slot?: number }) =>
    request<T.Twist>(`/stories/${storyId}/twists`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTwist: (
    twistId: string,
    data: Partial<
      Pick<
        T.Twist,
        "name" | "the_truth" | "the_misdirection" | "twist_type" | "revealed_at_node_id" | "color_slot"
      >
    >,
  ) =>
    request<T.Twist>(`/twists/${twistId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTwist: (twistId: string) => request<void>(`/twists/${twistId}`, { method: "DELETE" }),
  getTwistsForScene: (nodeId: string) => request<T.Twist[]>(`/structure/${nodeId}/twists`),
  analyzeTwist: (twistId: string) =>
    request<T.StructuredResult>(`/twists/${twistId}/analyze`, { method: "POST" }),
  createClue: (twistId: string, data: Partial<Omit<T.TwistClue, "id" | "twist_id">> = {}) =>
    request<T.TwistClue>(`/twists/${twistId}/clues`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateClue: (clueId: string, data: Partial<Omit<T.TwistClue, "id" | "twist_id">>) =>
    request<T.TwistClue>(`/twist-clues/${clueId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteClue: (clueId: string) => request<void>(`/twist-clues/${clueId}`, { method: "DELETE" }),
};
