import { Check, Circle, Minus, X } from "lucide-react";
import type { AIJob } from "../../../api/jobs";
import { clockTime } from "../../chronicle/timelineFormat";
import { isUnseen, jobDetailsPath, jobLine, jobOpen } from "../../../lib/jobs/jobs";
import { navigateTo } from "../../../lib/navigation";
import { useJobsStore } from "../../../stores/jobsStore";
import styles from "./Jobs.module.css";

/** Running in colour (the Assistant's, or local work's teal), waiting hollow, then how it ended. */
export function JobMark({ status, ai }: { status: string; ai: boolean }) {
  if (status === "running")
    return <span className={`${styles.ring} ${ai ? styles.ringAi : styles.ringLocal}`} aria-hidden />;
  if (status === "queued") return <Circle size={12} className={styles.markQueued} aria-hidden />;
  if (status === "done") return <Check size={13} className={styles.markDone} aria-hidden />;
  if (status === "error") return <X size={13} className={styles.markFailed} aria-hidden />;
  return <Minus size={13} className={styles.markStopped} aria-hidden />;
}

/** The label, and the book when the label does not already say it. */
function title(job: AIJob): string {
  const book = job.story_title;
  return book && !job.label.includes(book) ? `${job.label} · ${book}` : job.label;
}

/**
 * One job in the list: what and where, what it is doing or how it ended, and what can be
 * done with it from here (doc 21 P4).
 */
export default function JobRow({ job, now, onLeave }: { job: AIJob; now: number; onLeave: () => void }) {
  const { cancel, runNext, retry } = useJobsStore.getState();
  const open = jobOpen(job);
  const details = jobDetailsPath(job);
  const go = (to: string) => {
    onLeave();
    navigateTo(to);
  };
  const when = job.started_at ?? job.created_at;
  const lineClass = job.status === "error" ? styles.lineFailed : styles.line;

  return (
    <li className={`${styles.row} ${isUnseen(job) ? styles.rowUnseen : ""}`}>
      <span className={styles.mark}>
        <JobMark status={job.status} ai={job.lane !== "local"} />
      </span>
      <div className={styles.rowBody}>
        <span className={styles.rowTitle}>{title(job)}</span>
        <span className={lineClass}>
          {jobLine(job, now)}
          {job.status === "running" && <span className={styles.quiet}> · started {clockTime(when)}</span>}
          {job.quiet && <span className={styles.quiet}> · automatic</span>}
        </span>
        {job.status === "running" && job.total > 0 && (
          <span className={styles.bar} aria-hidden>
            <span style={{ width: `${Math.min(100, (job.progress / job.total) * 100)}%` }} />
          </span>
        )}
      </div>
      <div className={styles.actions}>
        {job.status === "running" && !job.cancel_requested && (
          <button
            type="button"
            className={styles.action}
            onClick={() => void cancel(job.id)}
            title={job.stop === "now" ? "Stop now" : "Stop after the step in hand"}
          >
            Stop
          </button>
        )}
        {job.status === "queued" && (job.queue_position ?? 1) > 1 && (
          <button type="button" className={styles.action} onClick={() => void runNext(job.id)}>
            Run next
          </button>
        )}
        {job.status === "queued" && (
          <button type="button" className={styles.action} onClick={() => void cancel(job.id)}>
            Remove
          </button>
        )}
        {open && (
          <button type="button" className={styles.action} onClick={() => go(open.to)} title={open.label}>
            Open
          </button>
        )}
        {(job.status === "error" || job.status === "cancelled") && (
          <button type="button" className={styles.action} onClick={() => void retry(job.id)}>
            Retry
          </button>
        )}
        {!open && details && !(job.status === "queued") && (
          <button type="button" className={styles.action} onClick={() => go(details)}>
            Details
          </button>
        )}
      </div>
    </li>
  );
}
