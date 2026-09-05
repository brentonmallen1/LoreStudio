import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { api } from "../../../api/client";
import { toolsApi } from "../../../api/tools";
import type { StructureNode } from "../../../types";
import type { QuoteStyleReport } from "../../../types/tools";
import { useStoryStore } from "../../../stores/storyStore";
import styles from "../SceneEditor.module.css";

/** Straight vs curly quote usage across the story, with one-click normalisation. */
export default function QuotesField({ activeNode }: { activeNode: StructureNode }) {
  const { setActiveNode } = useStoryStore();
  const [report, setReport] = useState<QuoteStyleReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    toolsApi
      .quoteStyles(activeNode.story_id)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeNode.story_id, activeNode.updated_at]);

  async function normalize(style: "curly" | "straight") {
    if (!report) return;
    const preview = await toolsApi.normalizeQuotes(activeNode.story_id, { style, dry_run: true });
    if (preview.changed_chars === 0) return;
    const ok = window.confirm(
      `Convert ${preview.changed_chars} quote characters in ${preview.scenes.length} scene${preview.scenes.length === 1 ? "" : "s"} to ${style} quotes? Speaker tags and markup are not touched.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await toolsApi.normalizeQuotes(activeNode.story_id, { style });
      const fresh = await api.getNode(activeNode.id);
      setActiveNode(fresh);
      setReport(await toolsApi.quoteStyles(activeNode.story_id));
    } finally {
      setBusy(false);
    }
  }

  if (!report || (report.total.straight === 0 && report.total.curly === 0)) return null;

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>
          <Quote size={11} className={styles.nlpIcon} /> Quote style
        </label>
      </div>
      <p className={styles.overviewHint}>
        {report.total.straight.toLocaleString()} straight · {report.total.curly.toLocaleString()} curly across
        the story
        {report.mixed ? " — mixed styles; pick one:" : ""}
      </p>
      <div className={styles.conflictActions}>
        <button
          className={styles.conflictBtn}
          disabled={busy || report.total.straight === 0}
          onClick={() => normalize("curly")}
        >
          Make all curly “ ”
        </button>
        <button
          className={styles.conflictBtn}
          disabled={busy || report.total.curly === 0}
          onClick={() => normalize("straight")}
        >
          Make all straight " "
        </button>
      </div>
    </div>
  );
}
