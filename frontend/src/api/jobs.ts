import { request } from "./request";
import type { ActivityLog } from "../types";

/**
 * Long-running work, AI or local (doc 06 §8, doc 21 Jobs). Kept out of client.ts (size budget).
 */
export interface AIJob {
  id: string;
  kind: string;
  label: string;
  /** queued | running | done | error | cancelled */
  status: string;
  story_id: string | null;
  /** What the job was asked to do, as given at enqueue time. */
  params: Record<string, unknown>;
  progress: number;
  total: number;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** model | local (doc 21): local work never waits behind the model. */
  lane?: "model" | "local";
  /** author | auto, and for automatic work when it ran ("when the story opened"). */
  origin?: "author" | "auto";
  origin_note?: string | null;
  /** Automatic work: in the list and the Chronicle, never a toast. */
  quiet?: boolean;
  /** What it is doing now, or why it is waiting. */
  step_label?: string | null;
  /** When the Jobs list showed it finished; until then it is unseen. */
  seen_at?: string | null;
  retry_of?: string | null;
  story_title?: string | null;
  /** 1 for the next to run in its lane. */
  queue_position?: number | null;
  cancel_requested?: boolean;
  /** now | between: Stop stops it at once, or after the step in hand. */
  stop?: "now" | "between";
  /** Why a model job is not running yet: a reply, the cool-down after one, or a pause. */
  waiting?: string | null;
  /** The next model job, held by the cool-down or a pause: Start now may start it. */
  can_start_now?: boolean;
}

export const ACTIVE_JOB_STATUSES = ["queued", "running"];

export const jobsApi = {
  list: (params: { storyId?: string; activeOnly?: boolean; lane?: string; sinceHours?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.storyId) query.set("story_id", params.storyId);
    if (params.activeOnly) query.set("active_only", "true");
    if (params.lane) query.set("lane", params.lane);
    if (params.sinceHours !== undefined) query.set("since_hours", String(params.sinceHours));
    return request<AIJob[]>(`/jobs${query.toString() ? `?${query}` : ""}`);
  },
  get: (jobId: string) => request<AIJob>(`/jobs/${jobId}`),
  /** Every AI call and log row the job wrote, oldest first. */
  activity: (jobId: string) => request<ActivityLog[]>(`/jobs/${jobId}/activity`),
  cancel: (jobId: string) => request<AIJob>(`/jobs/${jobId}/cancel`, { method: "POST" }),
  runNext: (jobId: string) => request<AIJob>(`/jobs/${jobId}/run-next`, { method: "POST" }),
  retry: (jobId: string) => request<AIJob>(`/jobs/${jobId}/retry`, { method: "POST" }),
  /** Skip the cool-down after a reply (or a pause) for this job. */
  startNow: (jobId: string) => request<AIJob>(`/jobs/${jobId}/start-now`, { method: "POST" }),
  /** The Jobs list showed these finished: no longer unseen in any window. */
  seen: (ids: string[]) =>
    request<{ marked: number }>(`/jobs/seen`, { method: "POST", body: JSON.stringify({ ids }) }),
  /** Queue one Assistant check from Run checks (an AI_FEATURES id). Asking twice gives one job. */
  check: (storyId: string, feature: string) =>
    request<AIJob>(`/stories/${storyId}/checks/${feature}`, { method: "POST" }),
  /** Queue the editorial pass over a scope. */
  editorialPass: (
    storyId: string,
    body: { context_level: string; scope_type: string; scope_ids: string[] },
  ) => request<AIJob>(`/stories/${storyId}/editorial/jobs`, { method: "POST", body: JSON.stringify(body) }),
  /** Queue the Assistant's reading of an import's approved people and places (no story yet). */
  importEnrich: (
    sessionId: string,
    candidates: import("../types").ExtractionCandidate[],
    options: import("../types").AIEnrichOptions,
  ) =>
    request<AIJob>(`/import/${sessionId}/enrich-candidates/jobs`, {
      method: "POST",
      body: JSON.stringify({ candidates, options }),
    }),
  /** Whether an import is still open on the server (30 minutes from its last step). */
  importAlive: (sessionId: string) =>
    request<{ alive: boolean }>(`/import/${sessionId}`).then(
      () => true,
      () => false,
    ),
  /** Queue a summary refresh for a whole manuscript. */
  sceneSummaries: (storyId: string, forceRefresh = false) =>
    request<AIJob>(`/stories/${storyId}/jobs/scene-summaries`, {
      method: "POST",
      body: JSON.stringify({ force_refresh: forceRefresh }),
    }),
};

/**
 * Resolve when a job ends, for a caller that wants to await the work as before. Aborting
 * asks the job to stop — it finishes the item in hand, as a Stop in Chronicle would.
 */
export async function waitForJob(jobId: string, signal?: AbortSignal, everyMs = 1500): Promise<AIJob> {
  for (;;) {
    if (signal?.aborted) {
      await jobsApi.cancel(jobId).catch(() => undefined);
      throw new DOMException("Stopped", "AbortError");
    }
    const job = await jobsApi.get(jobId);
    if (job.status === "error") throw new Error(job.error || "The job failed.");
    if (!ACTIVE_JOB_STATUSES.includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}
