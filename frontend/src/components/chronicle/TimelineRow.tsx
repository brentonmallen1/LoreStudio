import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Square,
  Star,
  StopCircle,
} from "lucide-react";
import type { TimelineEntry } from "../../api/chronicle";
import type { AIJob } from "../../api/jobs";
import type { ActivityLog } from "../../types";
import {
  JOB_STATUS_TEXT,
  callProblem,
  clockTime,
  formatDuration,
  isActiveJob,
  jobDuration,
  jobOutcome,
  logTitle,
  plainText,
} from "./timelineFormat";
import styles from "./Timeline.module.css";

export function JobIcon({ job }: { job: AIJob }) {
  if (job.status === "running") return <Loader2 size={13} className={`${styles.spin} ${styles.iconAi}`} />;
  if (job.status === "queued") return <Clock size={13} className={styles.iconMuted} />;
  if (job.status === "error") return <AlertTriangle size={13} className={styles.iconDanger} />;
  if (job.status === "cancelled") return <StopCircle size={13} className={styles.iconMuted} />;
  return <CheckCircle2 size={13} className={styles.iconOk} />;
}

function LogIcon({ log }: { log: ActivityLog }) {
  if (callProblem(log)) return <AlertTriangle size={13} className={styles.iconDanger} />;
  return <Activity size={13} className={log.category === "ai" ? styles.iconAi : styles.iconNlp} />;
}

/** The right-hand facts for a call: model, tokens, time taken. */
export function CallMeta({ log }: { log: ActivityLog }) {
  const m = log.metadata_ ?? {};
  const problem = callProblem(log);
  const tokensIn = m.tokens_in as number | undefined;
  const latency = m.latency_ms as number | undefined;
  return (
    <>
      {problem && <span className={styles.problem}>{problem}</span>}
      {typeof m.model === "string" && <span className={styles.metaQuiet}>{m.model}</span>}
      {tokensIn != null && (
        <span className={styles.metaQuiet} title="Tokens sent ↑ and received ↓">
          {tokensIn}↑ {String(m.tokens_out ?? "?")}↓
        </span>
      )}
      {latency != null && <span className={styles.metaQuiet}>{formatDuration(latency)}</span>}
    </>
  );
}

function summaryOf(entry: TimelineEntry): string {
  if (entry.job) {
    const job = entry.job;
    if (job.status === "error") return job.error ?? "Failed.";
    if (isActiveJob(job))
      return job.total > 0 ? `${job.progress} of ${job.total}` : JOB_STATUS_TEXT[job.status];
    return jobOutcome(job).sentence || JOB_STATUS_TEXT[job.status];
  }
  const log = entry.log;
  return plainText(log.metadata_?.prompt) || plainText(log.description);
}

interface Props {
  entry: TimelineEntry;
  selected: boolean;
  onSelect: () => void;
  onStar?: (log: ActivityLog) => void;
  onStop?: (job: AIJob) => void;
}

/** One row of Chronicle › Activity: a call, a log line, or a job with its calls folded in. */
export default function TimelineRow({ entry, selected, onSelect, onStar, onStop }: Props) {
  const { job, log } = entry;
  const title = job ? job.label : logTitle(log);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected || undefined}
      className={`${styles.row} ${selected ? styles.rowSelected : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className={styles.rowIcon}>{job ? <JobIcon job={job} /> : <LogIcon log={log} />}</span>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {title}
          {job && <span className={styles.kindTag}>Job</span>}
        </span>
        <span className={styles.rowSummary}>{summaryOf(entry)}</span>
      </span>
      <span className={styles.rowMeta}>
        {job ? (
          <>
            {job.status === "error" || job.status === "cancelled" ? (
              <span className={styles.problem}>{JOB_STATUS_TEXT[job.status]}</span>
            ) : null}
            {entry.call_count > 0 && (
              <span className={styles.metaQuiet}>
                {entry.call_count} {entry.call_count === 1 ? "call" : "calls"}
              </span>
            )}
            {jobDuration(job) && <span className={styles.metaQuiet}>{jobDuration(job)}</span>}
          </>
        ) : (
          <CallMeta log={log} />
        )}
        <span className={styles.time}>{clockTime(entry.at)}</span>
      </span>
      <span className={styles.rowActions}>
        {job && isActiveJob(job) && onStop && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={(e) => {
              e.stopPropagation();
              onStop(job);
            }}
            title={job.status === "running" ? "Stop after the current step" : "Cancel"}
            aria-label={`Stop ${job.label}`}
          >
            <Square size={12} />
          </button>
        )}
        {log && onStar && (
          <button
            type="button"
            className={`${styles.iconBtn} ${log.starred ? styles.starred : styles.revealOnHover}`}
            onClick={(e) => {
              e.stopPropagation();
              onStar(log);
            }}
            title={log.starred ? "Unstar" : "Star to keep it under Starred"}
            aria-label={log.starred ? "Unstar" : "Star"}
            aria-pressed={log.starred}
          >
            <Star size={12} />
          </button>
        )}
      </span>
    </div>
  );
}
