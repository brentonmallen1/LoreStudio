import type { FindingSeverity, FindingSource } from "../../types/findings";
import { SEVERITY_WORDS, SOURCE_WORDS } from "../../lib/findings/words";
import styles from "./Findings.module.css";

/**
 * A finding's severity as a shape as well as a colour (doc 30 D5, D8): a triangle to look at
 * first, a square worth a look, a ring for a small thing. Never colour alone.
 */
export default function SeverityMark({
  severity,
  label = true,
}: {
  severity: FindingSeverity;
  label?: boolean;
}) {
  const a11y = label ? { role: "img", "aria-label": SEVERITY_WORDS[severity] } : { "aria-hidden": true };
  return (
    <svg
      className={styles.mark}
      data-severity={severity}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      {...a11y}
    >
      {severity === "high" ? (
        <path d="M6 1 11 10H1z" />
      ) : severity === "mid" ? (
        <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
      ) : (
        <circle cx="6" cy="6" r="4" />
      )}
    </svg>
  );
}

/** The key on the Findings page: the three shapes and who said so, on the page, not in hovers. */
export function FindingsKey({ sources }: { sources: FindingSource[] }) {
  return (
    <div className={styles.key} role="group" aria-label="Key">
      {(Object.keys(SEVERITY_WORDS) as FindingSeverity[]).map((s) => (
        <span key={s} className={styles.keyItem}>
          <SeverityMark severity={s} label={false} />
          {SEVERITY_WORDS[s]}
        </span>
      ))}
      <span className={styles.keyGap} aria-hidden />
      {sources.map((s) => (
        <span key={s} className={styles.keyItem}>
          <span className={styles.source} data-source={s}>
            {SOURCE_WORDS[s].label}
          </span>
          {SOURCE_WORDS[s].key}
        </span>
      ))}
    </div>
  );
}
