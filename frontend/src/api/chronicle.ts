import { BASE, getToken, request } from "./request";
import type { AIJob } from "./jobs";
import type { ActivityLog } from "../types";

export type TimelineFilter = "all" | "running" | "problems" | "results" | "analyses" | "starred";

export interface TimelineQuery {
  story_id?: string;
  filter?: TimelineFilter;
  /** Writer mode: no AI calls, no jobs. */
  exclude_ai?: boolean;
  q?: string;
  /** One feature's rows only ("pacing-analysis"). */
  feature?: string;
  /** Rows to fetch from the top; "load more" raises it. */
  limit?: number;
}

/** A row of Chronicle › Activity: an activity log entry, or a job with its call count. */
export type TimelineEntry =
  | { type: "log"; at: string; log: ActivityLog; job: null; call_count: number }
  | { type: "job"; at: string; log: null; job: AIJob; call_count: number };

/**
 * Chronicle: conversation history, activity logs, search and stats.
 *
 * Split out of client.ts, which is on the file-length debt list and had run out of slack.
 * Spread back into `api`, so every existing `api.listChronicleSessions(...)` call site
 * keeps working — this is a move, not a rename.
 */
export const chronicleApi = {
  // Chronicle — sessions
  listChronicleSessions: (params: {
    story_id?: string;
    context_type?: string;
    context_id?: string;
    archived?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.story_id) q.set("story_id", params.story_id);
    if (params.context_type) q.set("context_type", params.context_type);
    if (params.context_id) q.set("context_id", params.context_id);
    if (params.archived !== undefined) q.set("archived", String(params.archived));
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return request<{
      sessions: import("../types").ChronicleSession[];
      total: number;
      page: number;
      page_size: number;
    }>(`/chronicle/sessions?${q}`);
  },
  createChronicleSession: (data: {
    story_id: string;
    context_type: string;
    context_id?: string;
    context_label?: string;
    title?: string;
  }) =>
    request<import("../types").ChronicleSession>("/chronicle/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getChronicleSession: (sessionId: string) =>
    request<import("../types").ChronicleSessionDetail>(`/chronicle/sessions/${sessionId}`),
  updateChronicleSession: (
    sessionId: string,
    data: { title?: string; archived?: boolean; thinking?: boolean | null },
  ) =>
    request<import("../types").ChronicleSession>(`/chronicle/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteChronicleSession: (sessionId: string) =>
    request<void>(`/chronicle/sessions/${sessionId}`, { method: "DELETE" }),
  forkChronicleSession: (sessionId: string) =>
    request<import("../types").ChronicleSession>(`/chronicle/sessions/${sessionId}/fork`, { method: "POST" }),
  generateSessionTitle: (sessionId: string, signal?: AbortSignal): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}/chronicle/sessions/${sessionId}/generate-title`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal,
    });
  },
  addChronicleMessage: (
    sessionId: string,
    data: {
      role: string;
      content: string;
      model?: string;
      tokens_in?: number;
      tokens_out?: number;
    },
  ) =>
    request<import("../types").ChronicleMessage>(`/chronicle/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Chronicle — activity logs
  listActivityLogs: (params: {
    story_id?: string;
    category?: string;
    event_type?: string;
    starred?: boolean;
    features?: string;
    /** Only calls that failed, were stopped, or fell back off their schema. */
    problems?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.story_id) q.set("story_id", params.story_id);
    if (params.category) q.set("category", params.category);
    if (params.event_type) q.set("event_type", params.event_type);
    if (params.starred !== undefined) q.set("starred", String(params.starred));
    if (params.features) q.set("features", params.features);
    if (params.problems) q.set("problems", "true");
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return request<{
      logs: import("../types").ActivityLog[];
      total: number;
      page: number;
      page_size: number;
    }>(`/chronicle/activity?${q}`);
  },
  /** Chronicle › Activity: activity rows and jobs in one list, newest first. */
  chronicleTimeline: (params: TimelineQuery) => {
    const q = new URLSearchParams();
    if (params.story_id) q.set("story_id", params.story_id);
    if (params.filter && params.filter !== "all") q.set(params.filter, "true");
    if (params.exclude_ai) q.set("exclude_ai", "true");
    if (params.q) q.set("q", params.q);
    if (params.feature) q.set("feature", params.feature);
    q.set("page_size", String(params.limit ?? 50));
    return request<{ entries: TimelineEntry[]; total: number }>(`/chronicle/timeline?${q}`);
  },
  getActivityLog: (logId: string) => request<ActivityLog>(`/chronicle/activity/${logId}`),
  updateActivityLog: (logId: string, data: { starred?: boolean }) =>
    request<import("../types").ActivityLog>(`/chronicle/activity/${logId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Chronicle — search & stats
  searchChronicle: (params: { q: string; story_id?: string; page?: number; page_size?: number }) => {
    const qs = new URLSearchParams({ q: params.q });
    if (params.story_id) qs.set("story_id", params.story_id);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    return request<{ results: import("../types").ChronicleSearchResult[]; total: number; query: string }>(
      `/chronicle/search?${qs}`,
    );
  },
  getChronicleStats: (storyId?: string) => {
    const q = storyId ? `?story_id=${storyId}` : "";
    return request<import("../types").ChronicleStats>(`/chronicle/stats${q}`);
  },
};
