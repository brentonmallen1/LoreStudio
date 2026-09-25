import { useCallback, useEffect, useState } from "react";
import { ACTIVE_JOB_STATUSES, jobsApi, type AIJob } from "../api/jobs";
import { MUTATION_EVENT } from "../api/request";

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

  const refresh = useCallback(async (): Promise<AIJob[]> => {
    try {
      const list = await jobsApi.list({ storyId });
      setJobs(list);
      return list;
    } catch {
      // A jobs list that cannot load must not break the page it sits in.
      return [];
    }
  }, [storyId]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let live = true;

    // Busy is decided from the list just fetched. It used to read `jobs` from this
    // effect's closure — the empty first render, forever — so it never saw a running job
    // and polled every 20s regardless: a short job could start and finish unseen.
    async function tick() {
      if (!live) return;
      const list = await refresh();
      if (!live) return;
      const busy = list.some((j) => ACTIVE_JOB_STATUSES.includes(j.status));
      clearTimeout(timer);
      timer = setTimeout(tick, busy ? BUSY_MS : IDLE_MS);
    }
    // Queuing a job is a mutation; look straight away rather than at the next idle tick.
    const onMutation = () => {
      clearTimeout(timer);
      tick();
    };
    tick();
    window.addEventListener(MUTATION_EVENT, onMutation);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener(MUTATION_EVENT, onMutation);
    };
  }, [refresh, enabled]);

  const active = jobs.filter((j) => ACTIVE_JOB_STATUSES.includes(j.status));
  return { jobs, active, refresh, cancel: async (id: string) => (await jobsApi.cancel(id), refresh()) };
}
