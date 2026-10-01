import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api } from "../../api/client";
import { parseServerDate } from "../../lib/serverDate";
import type { ActivityLog } from "../../types";
import AICallDetail from "./AICallDetail";
import AnalysisResult, { FEATURE_META } from "./analysis/AnalysisResult";
import AskAboutAnalysis from "./analysis/AskAboutAnalysis";
import { EditorialReportCard } from "./analysis/EditorialReportCard";
import { clockTime, logTitle, plainText } from "./timelineFormat";
import styles from "./Timeline.module.css";

interface Props {
  logId: string;
  onOpenJob: (jobId: string) => void;
}

/**
 * One activity row, opened. For an AI call that is the full record — prompt, response,
 * thinking, options — and, when a job made it, the way back to that job. For an analysis
 * run or an editorial pass it is the whole result, which is where the findings feed
 * points for "read the run" (doc 12 P4).
 */
export default function LogDetail({ logId, onOpenJob }: Props) {
  const [log, setLog] = useState<ActivityLog | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // Keyed by id in the page: a new row is a new component, so nothing to reset here.
    let live = true;
    api
      .getActivityLog(logId)
      .then((row) => live && setLog(row))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [logId]);

  if (missing) return <p className={styles.empty}>This entry no longer exists.</p>;
  if (!log) return <p className={styles.empty}>Loading…</p>;

  const jobId = log.metadata_?.job_id as string | undefined;
  const prompt = plainText(log.metadata_?.prompt);
  const response = plainText(log.metadata_?.response);

  return (
    <div className={styles.detailBody}>
      {log.category !== "ai" && <h2 className={styles.detailTitle}>{logTitle(log)}</h2>}
      <p className={styles.detailStatus}>
        <span className={styles.metaQuiet}>
          {parseServerDate(log.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })},{" "}
          {clockTime(log.created_at)}
        </span>
        {jobId && (
          <button type="button" className={styles.linkBtn} onClick={() => onOpenJob(jobId)}>
            Made by a job — open it
          </button>
        )}
        <button
          type="button"
          className={`${styles.iconBtn} ${log.starred ? styles.starred : ""}`}
          onClick={async () => setLog(await api.updateActivityLog(logId, { starred: !log.starred }))}
          aria-pressed={log.starred}
          title={log.starred ? "Unstar" : "Star to keep it under Starred"}
        >
          <Star size={13} />
        </button>
      </p>
      {log.category === "ai" ? (
        <AICallDetail logId={logId} />
      ) : log.event_type === "analysis_run" ? (
        <>
          <p className={styles.sentence}>{plainText(log.description)}</p>
          <AskAboutAnalysis
            log={log}
            label={FEATURE_META[(log.metadata_?.feature as string) ?? ""]?.label ?? "this analysis"}
          />
          <AnalysisResult log={log} />
        </>
      ) : log.event_type === "editorial_pass" ? (
        <EditorialReportCard
          log={log}
          onDelete={async (id) => {
            if (log.story_id) await api.deleteEditorialReport(log.story_id, id);
            setMissing(true);
          }}
        />
      ) : (
        <>
          <p className={styles.sentence}>{plainText(log.description)}</p>
          {prompt && <p className={styles.note}>{prompt}</p>}
          {response && <p className={styles.note}>{response}</p>}
        </>
      )}
    </div>
  );
}
