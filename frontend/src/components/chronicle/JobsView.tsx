import { CircleSlash, Loader, X } from "lucide-react";
import { useJobs } from "../../hooks/useJobs";
import { relativeTime } from "../../utils/relativeTime";
import styles from "./JobsView.module.css";

const STATUS_TEXT: Record<string, string> = {
  queued: "Waiting",
  running: "Running",
  done: "Finished",
  error: "Failed",
  cancelled: "Stopped",
};

/**
 * Chronicle › Jobs (doc 06 §8): the long-running AI work, past and present.
 *
 * A job that failed or was stopped stays in the list with its reason — the point of
 * queueing this work was to stop it disappearing into a request that never came back.
 */
export default function JobsView({ storyId }: { storyId?: string }) {
  const { jobs, cancel } = useJobs(storyId);

  if (jobs.length === 0) {
    return (
      <p className={styles.empty}>
        No jobs yet. Long-running work — refreshing every scene summary, whole-story analyses — is queued here
        so you can watch it and stop it.
      </p>
    );
  }

  return (
    <div className={styles.list}>
      {jobs.map((job) => {
        const active = job.status === "queued" || job.status === "running";
        return (
          <div key={job.id} className={styles.card}>
            <div className={styles.icon}>
              {active ? <Loader size={12} className={styles.spin} /> : <CircleSlash size={12} />}
            </div>
            <div className={styles.body}>
              <p className={styles.title}>{job.label}</p>
              <p className={styles.meta}>
                <span className={`${styles.status} ${styles[job.status] ?? ""}`}>
                  {STATUS_TEXT[job.status] ?? job.status}
                </span>
                {job.total > 0 && (
                  <span>
                    {" · "}
                    {job.progress} of {job.total}
                  </span>
                )}
                {" · "}
                {relativeTime(job.created_at)}
              </p>
              {job.error && <p className={styles.error}>{job.error}</p>}
              {job.result && !job.error && (
                <p className={styles.result}>
                  {Object.entries(job.result)
                    .filter(([, v]) => typeof v === "number" && v > 0)
                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            {active && (
              <button
                className={styles.cancelBtn}
                onClick={() => cancel(job.id)}
                title={job.status === "running" ? "Stop after the current step" : "Cancel"}
                aria-label={`Stop ${job.label}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
