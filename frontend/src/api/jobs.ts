import { request } from "./request";

/**
 * Long-running AI work (doc 06 §8). Kept out of client.ts (size budget).
 */
export interface AIJob {
  id: string;
  kind: string;
  label: string;
  /** queued | running | done | error | cancelled */
  status: string;
  story_id: string | null;
  progress: number;
  total: number;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export const ACTIVE_JOB_STATUSES = ["queued", "running"];

export const jobsApi = {
  list: (params: { storyId?: string; activeOnly?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.storyId) query.set("story_id", params.storyId);
    if (params.activeOnly) query.set("active_only", "true");
    return request<AIJob[]>(`/jobs${query.toString() ? `?${query}` : ""}`);
  },
  get: (jobId: string) => request<AIJob>(`/jobs/${jobId}`),
  cancel: (jobId: string) => request<AIJob>(`/jobs/${jobId}/cancel`, { method: "POST" }),
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
