import { announceScenesRewritten } from "../../../lib/sceneEvents";
import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { toolsApi } from "../../../api/tools";
import type { StructureNode } from "../../../types";
import type { QuoteStyleReport } from "../../../types/tools";
import styles from "../SceneEditor.module.css";
import actions from "../SaveStatus.module.css";

/** Straight vs curly quote usage across the story, with one-click normalisation. */
export default function QuotesField({ activeNode }: { activeNode: StructureNode }) {
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
      const done = await toolsApi.normalizeQuotes(activeNode.story_id, { style });
      // Not setActiveNode(fresh): that refreshed updated_at under an editor still holding
      // the old text, and its next autosave wrote the straight quotes back unopposed.
      announceScenesRewritten(done.scenes.map((scene) => scene.node_id));
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
        {report.mixed ? ". Mixed styles; pick one:" : ""}
      </p>
      <div className={actions.actions}>
        <button
          className={actions.btn}
          disabled={busy || report.total.straight === 0}
          onClick={() => normalize("curly")}
        >
          Make all curly “ ”
        </button>
        <button
          className={actions.btn}
          disabled={busy || report.total.curly === 0}
          onClick={() => normalize("straight")}
        >
          Make all straight " "
        </button>
      </div>
    </div>
  );
}
