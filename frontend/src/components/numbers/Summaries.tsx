import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Orbit, Square } from "lucide-react";
import { jobsApi } from "../../api/jobs";
import { useJobs } from "../../hooks/useJobs";
import { toast } from "../../stores/toastStore";
import type { NumbersSummaries } from "../../types/numbers";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * The Assistant's scene summaries, counted, with the job that writes the missing and the
 * out-of-date ones (the same job Findings' ⋯ starts). A run started anywhere shows here, and
 * the counts reload when it ends. Studio mode only: the page leaves it out in Writer mode.
 */
export default function Summaries({
  storyId,
  summaries: s,
  onDone,
}: {
  storyId: string;
  summaries: NumbersSummaries;
  onDone: () => void;
}) {
  const { active, refresh, cancel } = useJobs(storyId);
  const job = active.find((j) => j.kind === "scene-summaries");
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !job) onDone();
    wasRunning.current = !!job;
  }, [job, onDone]);

  const owed = s.stale + s.missing;
  async function start() {
    try {
      await jobsApi.sceneSummaries(storyId);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The summaries could not be started.");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="numbers-summaries">
      <SectionHeading section="summaries" title="Scene summaries" />
      <p className={styles.lede}>
        The Assistant&rsquo;s short summaries of each written scene: <strong>{s.fresh}</strong> up to date,{" "}
        <strong>{s.stale}</strong> written before the scene last changed, <strong>{s.missing}</strong> not
        written yet. Every run is in the <Link to={`/stories/${storyId}/chronicle`}>Chronicle</Link>.
      </p>
      {job ? (
        <div className={styles.jobRow}>
          <span className={styles.jobState} role="status">
            {job.total > 0
              ? `Writing ${Math.min(job.progress + 1, job.total)} of ${job.total}…`
              : "Starting…"}
          </span>
          <button type="button" className={styles.aiBtn} onClick={() => void cancel(job.id)}>
            <Square size={13} aria-hidden />
            Cancel
          </button>
        </div>
      ) : (
        owed > 0 && (
          <button type="button" className={styles.aiBtn} onClick={() => void start()}>
            <Orbit size={13} aria-hidden />
            Write {owed} {owed === 1 ? "summary" : "summaries"}
          </button>
        )
      )}
    </section>
  );
}
