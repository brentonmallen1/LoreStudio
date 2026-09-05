import { useEffect, useState } from "react";
import { RefreshCw, ScanSearch } from "lucide-react";
import { toolsApi } from "../../../api/tools";
import type { StructureNode } from "../../../types";
import type { ConsistencyFinding } from "../../../types/tools";
import styles from "../SceneEditor.module.css";

const KIND_LABEL: Record<string, string> = {
  name_drift: "Name spelling",
  unknown_speaker: "Unknown speaker",
  pov_drift: "POV drift",
};

/** Deterministic consistency checks for the active scene (no model involved). */
export default function ChecksField({ activeNode }: { activeNode: StructureNode }) {
  const [findings, setFindings] = useState<ConsistencyFinding[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await toolsApi.consistencyChecks(activeNode.story_id, activeNode.id);
      setFindings(res.findings);
    } catch {
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    toolsApi
      .consistencyChecks(activeNode.story_id, activeNode.id)
      .then((res) => {
        if (!cancelled) setFindings(res.findings);
      })
      .catch(() => {
        if (!cancelled) setFindings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeNode.id, activeNode.updated_at, activeNode.story_id]);

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>
          <ScanSearch size={11} className={styles.nlpIcon} /> Checks
        </label>
        <button
          className={styles.addLinkBtn}
          onClick={run}
          disabled={loading}
          title="Re-run consistency checks"
        >
          <RefreshCw size={11} className={loading ? styles.spinIcon : ""} />
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>
      {findings === null ? (
        <p className={styles.overviewHint}>Checking names, speakers and point of view…</p>
      ) : findings.length === 0 ? (
        <p className={styles.overviewHint}>No consistency issues found in this scene.</p>
      ) : (
        <ul className={styles.checkList}>
          {findings.map((f, i) => (
            <li
              key={i}
              className={`${styles.checkItem} ${f.severity === "warn" ? styles.checkItemWarn : ""}`}
            >
              <span className={styles.checkKind}>{KIND_LABEL[f.kind] ?? f.kind}</span>
              <span className={styles.checkText}>
                <strong>{f.text}</strong>
                {f.suggestion && (
                  <> · {f.kind === "name_drift" ? `did you mean ${f.suggestion}?` : f.suggestion}</>
                )}
              </span>
              {f.excerpt && <span className={styles.checkExcerpt}>{f.excerpt}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
