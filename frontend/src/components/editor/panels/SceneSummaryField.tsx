import { useState } from "react";
import { Compass } from "lucide-react";
import { api } from "../../../api/client";
import type { StructureNode } from "../../../types";
import { useLLMStream } from "../../../hooks/useLLMStream";
import { formatDate, formatRelative } from "../../../lib/utils";
import styles from "../SceneEditor.module.css";

/** The AI-generated scene summary with stale indicator and manual edit. Studio-only surface. */
export default function SceneSummaryField({
  activeNode,
  setActiveNode,
}: {
  activeNode: StructureNode;
  setActiveNode: (node: StructureNode) => void;
}) {
  // Parent (SceneOverviewPanel) is keyed by node id, so this seeds once per scene.
  const [summary, setSummary] = useState(activeNode.content_summary ?? "");

  const {
    stream,
    text: streamText,
    isStreaming,
  } = useLLMStream({
    requestId: `scene-summary:${activeNode.id}`,
    label: "Summarizing scene",
    tabId: "story",
    onComplete: (full) => {
      setSummary(full);
      setActiveNode({ ...activeNode, content_summary: full, summary_stale: false });
    },
  });

  const hasAny = Boolean(summary || streamText);
  const indicator = !hasAny
    ? styles.staleIndicatorNone
    : activeNode.summary_stale
      ? styles.staleIndicatorStale
      : styles.staleIndicatorFresh;
  const indicatorTitle = !hasAny
    ? "Not generated"
    : activeNode.summary_stale
      ? "Stale: content has changed"
      : "Fresh";

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>
          AI summary
          <span className={indicator} title={indicatorTitle} />
          {activeNode.summary_stale && summary && <span className={styles.staleBadge}>Stale</span>}
          {hasAny && activeNode.summary_updated_at && (
            <span className={styles.summaryTimestamp} title={formatDate(activeNode.summary_updated_at)}>
              {formatRelative(activeNode.summary_updated_at)}
            </span>
          )}
        </label>
        <button
          className={styles.summaryRefreshBtn}
          onClick={() => stream((signal) => api.summarizeNode(activeNode.id, signal))}
          disabled={isStreaming || !activeNode.content?.trim()}
          title="Generate/Refresh summary"
        >
          <Compass size={11} />
          {!hasAny ? "Generate" : isStreaming ? "Generating…" : "Regenerate"}
        </button>
      </div>
      {isStreaming && streamText ? (
        <p className={styles.overviewHint} style={{ fontStyle: "italic" }}>
          {streamText}
        </p>
      ) : summary ? (
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={async () => {
            const updated = await api.updateNode(activeNode.id, { content_summary: summary });
            setActiveNode({ ...activeNode, ...updated });
          }}
          className={styles.overviewTextarea}
          rows={3}
        />
      ) : (
        <p className={styles.overviewHint}>
          {activeNode.content?.trim()
            ? "Click Generate to create an AI summary of this scene's content."
            : "Write some content first, then generate a summary."}
        </p>
      )}
    </div>
  );
}
