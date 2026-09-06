import { useCallback, useEffect, useState } from "react";
import { ACTIVE_JOB_STATUSES, jobsApi, type AIJob } from "../api/jobs";

/** While work is running, check often enough to feel live; otherwise leave the server alone. */
const BUSY_MS = 2000;
const IDLE_MS = 20000;

/**
 * The author's jobs, refreshed while any are running (doc 06 §8).
 *
 * Polling rather than a socket: one worker, one user, and a queue that is usually empty —
 * a websocket would be more machinery than the problem deserves.
 */
export function useJobs(storyId?: string, enabled = true) {
  const [jobs, setJobs] = useState<AIJob[]>([]);

  const refresh = useCallback(async () => {
    try {
      setJobs(await jobsApi.list({ storyId }));
    } catch {
      // A jobs list that cannot load must not break the page it sits in.
    }
  }, [storyId]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let live = true;

    async function tick() {
      if (!live) return;
      await refresh();
      if (!live) return;
      const busy = jobs.some((j) => ACTIVE_JOB_STATUSES.includes(j.status));
      timer = setTimeout(tick, busy ? BUSY_MS : IDLE_MS);
    }
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, enabled]);

  const active = jobs.filter((j) => ACTIVE_JOB_STATUSES.includes(j.status));
  return { jobs, active, refresh, cancel: async (id: string) => (await jobsApi.cancel(id), refresh()) };
}
