import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useJobs } from "../../hooks/useJobs";
import { useStoryStore } from "../../stores/storyStore";
import { useLLMStore } from "../../stores/llmStore";
import styles from "./AIActivityIndicator.module.css";

/**
 * What the AI is doing right now: streams in flight and queued jobs (doc 06 §8).
 *
 * This used to track streams only, so a manuscript-wide summary refresh — the slowest
 * thing in the app — ran with nothing on screen to say so.
 */
export default function AIActivityIndicator() {
  const requests = useLLMStore((s) => s.requests);
  const cancelRequest = useLLMStore((s) => s.cancelRequest);
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const { active: activeJobs, cancel: cancelJob } = useJobs(storyId);

  const streams = Object.values(requests).filter((r) => r.status === "streaming");
  if (streams.length === 0 && activeJobs.length === 0) return null;

  return (
    <div className={styles.indicator}>
      <div className={styles.header}>
        <span className={styles.pulse} aria-hidden />
        <span className={styles.label}>AI Working</span>
      </div>
      {streams.map((req) => (
        <div key={req.id} className={styles.item}>
          <span className={styles.itemLabel}>{req.label}</span>
          <button
            className={styles.cancelBtn}
            onClick={() => cancelRequest(req.id)}
            aria-label={`Cancel ${req.label}`}
            title="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      {activeJobs.map((job) => (
        <div key={job.id} className={styles.item}>
          {/* Opens the job in the Chronicle: what it was asked, how far it is, its calls. */}
          <Link
            to={`/stories/${job.story_id ?? storyId}/chronicle?item=job:${job.id}`}
            className={styles.itemLabel}
            title="Open in the Chronicle"
          >
            {job.label}
            {job.total > 0 && (
              <span className={styles.progress}>
                {" "}
                {job.progress}/{job.total}
              </span>
            )}
          </Link>
          <button
            className={styles.cancelBtn}
            onClick={() => cancelJob(job.id)}
            aria-label={`Stop ${job.label}`}
            title={job.status === "running" ? "Stop after the current step" : "Cancel"}
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
