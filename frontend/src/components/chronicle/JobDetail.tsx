import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Square } from "lucide-react";
import { jobsApi, type AIJob } from "../../api/jobs";
import { parseServerDate } from "../../lib/serverDate";
import type { ActivityLog } from "../../types";
import AICallDetail from "./AICallDetail";
import { CallMeta, JobIcon } from "./TimelineRow";
import {
  JOB_STATUS_TEXT,
  callLabel,
  clockTime,
  isActiveJob,
  jobDuration,
  jobOutcome,
  jobParams,
  noCallsNote,
  plainText,
} from "./timelineFormat";
import { jobOpen } from "../../lib/jobs/jobs";
import styles from "./Timeline.module.css";

const BUSY_MS = 2000;

/**
 * A job, opened: what it was asked to do, what came of it, and every call it made.
 * This is the answer to "it says Finished — finished what?".
 */
export default function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<AIJob | null>(null);
  const [calls, setCalls] = useState<ActivityLog[]>([]);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [j, a] = await Promise.all([jobsApi.get(jobId), jobsApi.activity(jobId)]);
      setJob(j);
      setCalls(a);
      return j;
    } catch {
      setMissing(true);
      return null;
    }
  }, [jobId]);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      const j = await load();
      if (live && j && isActiveJob(j)) timer = setTimeout(tick, BUSY_MS);
    }
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [load]);

  if (missing) return <p className={styles.empty}>This job no longer exists.</p>;
  if (!job) return <p className={styles.empty}>Loading…</p>;

  const outcome = jobOutcome(job);
  const params = jobParams(job);
  const duration = jobDuration(job);
  const next = jobOpen(job);
  const aiCalls = calls.filter((c) => c.category === "ai");
  const otherRows = calls.filter((c) => c.category !== "ai");

  return (
    <div className={styles.detailBody}>
      <h2 className={styles.detailTitle}>{job.label}</h2>
      <p className={styles.detailStatus}>
        <JobIcon job={job} />
        <span>{JOB_STATUS_TEXT[job.status] ?? job.status}</span>
        {duration && <span className={styles.metaQuiet}>in {duration}</span>}
        <span className={styles.metaQuiet}>
          {parseServerDate(job.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })},{" "}
          {clockTime(job.created_at)}
        </span>
        {isActiveJob(job) && (
          <button
            type="button"
            className={styles.stopBtn}
            onClick={async () => setJob(await jobsApi.cancel(job.id))}
          >
            <Square size={11} />{" "}
            {job.status !== "running"
              ? "Remove from the queue"
              : job.stop === "now"
                ? "Stop"
                : "Stop after this step"}
          </button>
        )}
      </p>

      {isActiveJob(job) && job.total > 0 && (
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={job.total}
          aria-valuenow={job.progress}
        >
          <span style={{ width: `${Math.round((job.progress / job.total) * 100)}%` }} />
        </div>
      )}

      {job.error && <p className={styles.errorBox}>{job.error}</p>}

      {(outcome.sentence || outcome.details.length > 0) && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>What it did</h3>
          {outcome.sentence && <p className={styles.sentence}>{outcome.sentence}</p>}
          {outcome.details.length > 0 && (
            <dl className={styles.facts}>
              {outcome.details.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {next && (
            <Link to={next.to} className={styles.followUp}>
              {next.label} →
            </Link>
          )}
        </section>
      )}

      {params.length > 0 && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>What it was asked</h3>
          <dl className={styles.facts}>
            {params.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className={styles.detailSection}>
        <h3 className={styles.sectionLabel}>AI calls{aiCalls.length > 0 ? ` (${aiCalls.length})` : ""}</h3>
        {aiCalls.length === 0 ? (
          <p className={styles.note}>{noCallsNote(job)}</p>
        ) : (
          <div className={styles.callList}>
            {aiCalls.map((call) => {
              const expanded = open === call.id;
              return (
                <div key={call.id} className={styles.call}>
                  <button
                    type="button"
                    className={styles.callHead}
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : call.id)}
                  >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span className={styles.callTitle}>{callLabel(call)}</span>
                    <span className={styles.rowMeta}>
                      <CallMeta log={call} />
                      <span className={styles.time}>{clockTime(call.created_at)}</span>
                    </span>
                  </button>
                  {expanded && <AICallDetail logId={call.id} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {otherRows.length > 0 && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionLabel}>Also recorded</h3>
          {otherRows.map((row) => (
            <p key={row.id} className={styles.note}>
              {plainText(row.description)}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
