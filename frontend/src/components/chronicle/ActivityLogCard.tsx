import { stripStoredThoughts } from "../../lib/ai/thoughts";
import { useState } from "react";
import { Activity, Star } from "lucide-react";
import { api } from "../../api/client";
import { aiFeatureLabel } from "../../lib/ai/features.generated";
import type { ActivityLog } from "../../types";
import { relativeTime } from "../../utils/relativeTime";
import AICallDetail from "./AICallDetail";
import styles from "../../pages/ChroniclePage.module.css";

function featureLabel(log: ActivityLog): string {
  const feature = log.metadata_?.feature as string | undefined;
  // Labels come from the backend feature table (lib/ai/features.generated.ts). Rows
  // written before a feature was renamed fall back to the event type.
  if (feature) return aiFeatureLabel(feature);
  return log.event_type
    .replace(/^ai_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ActivityLogCard({
  log,
  onStarToggle,
}: {
  log: ActivityLog;
  onStarToggle?: (id: string, starred: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [starring, setStarring] = useState(false);
  const categoryColor: Record<string, string> = {
    ai: "var(--color-accent)",
    system: "var(--color-text-subtle)",
    task: "var(--segment-chapter)",
  };
  const prompt = log.metadata_?.prompt as string | undefined;
  const response = log.metadata_?.response as string | undefined;
  const model = log.metadata_?.model as string | undefined;
  const tokensIn = log.metadata_?.tokens_in as number | undefined;
  const tokensOut = log.metadata_?.tokens_out as number | undefined;
  const latency = log.metadata_?.latency_ms as number | undefined;
  const status = log.metadata_?.status as string | undefined;
  // AI rows carry a full record (prompt, options, raw response) behind /ai/calls/{id};
  // everything else only ever had its metadata preview.
  const isAICall = log.category === "ai";
  const hasContent = isAICall || !!(prompt || response);

  const responsePreview = response ? stripStoredThoughts(response) : response;

  async function toggleStar(e: React.MouseEvent) {
    e.stopPropagation();
    if (starring) return;
    setStarring(true);
    try {
      await api.updateActivityLog(log.id, { starred: !log.starred });
      onStarToggle?.(log.id, !log.starred);
    } finally {
      setStarring(false);
    }
  }

  return (
    <div
      className={`${styles.card} ${styles.logCard} ${hasContent ? styles.logCardExpandable : ""}`}
      onClick={() => hasContent && setExpanded((v) => !v)}
    >
      <div className={styles.cardIcon}>
        <Activity size={12} style={{ color: categoryColor[log.category] ?? "var(--color-text-subtle)" }} />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{featureLabel(log)}</p>
        {prompt && <p className={`${styles.cardPreview} ${styles.logPromptPreview}`}>{prompt}</p>}
        {responsePreview && <p className={styles.cardPreview}>{responsePreview}</p>}
        <p className={styles.cardMeta}>
          {model && <span className={styles.badge}>{model}</span>}
          {status && status !== "ok" && <span className={styles.badge}>{status}</span>}
          {tokensIn != null && (
            <span>
              {tokensIn}↑ {tokensOut}↓ tokens
            </span>
          )}
          {latency != null && (
            <span>{latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}</span>
          )}
          {" · "}
          {relativeTime(log.created_at)}
        </p>
      </div>
      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        <button
          className={`${styles.iconBtn} ${log.starred ? styles.starActive : ""}`}
          title={log.starred ? "Unstar" : "Star this summary"}
          onClick={toggleStar}
          disabled={starring}
        >
          <Star size={13} />
        </button>
      </div>
      {expanded && (
        <div className={styles.logDetail} onClick={(e) => e.stopPropagation()}>
          {isAICall ? (
            <AICallDetail logId={log.id} />
          ) : (
            <>
              {prompt && (
                <div className={styles.logMessage}>
                  <span className={styles.logRole}>You</span>
                  <p className={styles.logContent}>{prompt}</p>
                </div>
              )}
              {response && (
                <div className={styles.logMessage}>
                  <span className={styles.logRole}>AI</span>
                  <p className={styles.logContent}>{responsePreview}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
