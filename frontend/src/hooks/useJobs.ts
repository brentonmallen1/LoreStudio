import { useEffect, useMemo } from "react";
import { ACTIVE_JOB_STATUSES, type AIJob } from "../api/jobs";
import { JOB_FINISHED_EVENT, useJobsStore } from "../stores/jobsStore";

/**
 * The author's jobs (doc 06 §8), read from the one jobs store (doc 21 P7). Every caller
 * used to poll on its own, so Numbers polled twice; now there is one poller for the app,
 * running while anything here or the header's list is watching.
 *
 * Polling rather than a socket: one worker per lane, one user, and a queue that is usually
 * empty — a websocket would be more machinery than the problem deserves.
 */
export function useJobs(storyId?: string, enabled = true) {
  const all = useJobsStore((s) => s.jobs);
  const watch = useJobsStore((s) => s.watch);
  const refresh = useJobsStore((s) => s.refresh);
  const cancel = useJobsStore((s) => s.cancel);
  useEffect(() => (enabled ? watch() : undefined), [enabled, watch]);

  const jobs = useMemo(() => (storyId ? all.filter((j) => j.story_id === storyId) : all), [all, storyId]);
  const active = useMemo(() => jobs.filter((j) => ACTIVE_JOB_STATUSES.includes(j.status)), [jobs]);
  return { jobs, active, refresh, cancel };
}

/**
 * Reload when a job of these kinds finishes, once per job, wherever it was started from.
 * Shaped like useReloadOnUndo.
 */
export function useOnJobFinished(kinds: readonly string[], reload: (job: AIJob) => void) {
  const key = kinds.join(",");
  useEffect(() => {
    const wanted = key.split(",");
    const onFinished = (e: Event) => {
      const job = (e as CustomEvent<AIJob>).detail;
      if (wanted.includes(job.kind)) reload(job);
    };
    window.addEventListener(JOB_FINISHED_EVENT, onFinished);
    return () => window.removeEventListener(JOB_FINISHED_EVENT, onFinished);
  }, [key, reload]);
}
