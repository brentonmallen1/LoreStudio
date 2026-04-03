import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ContextSource } from "../../types";
import styles from "./LLMContextSources.module.css";

interface Props {
  sources: ContextSource[];
  loading?: boolean;
}

export default function LLMContextSources({ sources, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <div className={styles.loading}>Loading context…</div>;
  }

  if (sources.length === 0) return null;

  const included = sources.filter((s) => s.included);
  const missing = sources.filter((s) => !s.included);

  return (
    <div className={styles.root}>
      <button
        className={styles.toggle}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className={styles.toggleLabel}>Context</span>
        <span className={styles.summary}>
          {included.map((s) => s.label).join("  ·  ")}
        </span>
      </button>

      {expanded && (
        <div className={styles.detail}>
          {included.length > 0 && (
            <div className={styles.group}>
              {included.map((s) => (
                <div key={s.source} className={styles.sourceItem}>
                  <span className={styles.dot} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <div className={styles.group}>
              {missing.map((s) => (
                <div key={s.source} className={`${styles.sourceItem} ${styles.missing}`}>
                  <span className={styles.dotMissing} />
                  <span>{s.label}</span>
                  <span className={styles.missingNote}>not set</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
