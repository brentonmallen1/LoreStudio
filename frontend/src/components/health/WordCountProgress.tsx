import type { WordCountTarget } from "../../types";
import { nextFormLabel } from "../../utils/wordCount";
import styles from "./WordCountProgress.module.css";

interface Props {
  target: WordCountTarget;
  intendedLength: string;
}

export default function WordCountProgress({ target, intendedLength }: Props) {
  const barPct = Math.min(target.pct, 100);
  const barClass =
    target.warning_level === "exceeded"
      ? styles.barExceeded
      : target.warning_level === "approaching"
        ? styles.barApproaching
        : styles.barNormal;

  const next = nextFormLabel(intendedLength);

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <span className={styles.label}>Target</span>
        <span className={`${styles.pct} ${target.warning_level !== "normal" ? styles.pctWarn : ""}`}>
          {target.pct.toFixed(0)}% of {target.max.toLocaleString()} words
        </span>
      </div>
      <div className={styles.track}>
        <div className={`${styles.bar} ${barClass}`} style={{ width: `${barPct}%` }} />
        {target.soft_warning_at && (
          <div
            className={styles.softMarker}
            style={{ left: `${(target.soft_warning_at / target.max) * 100}%` }}
            title={`Soft ceiling: ${target.soft_warning_at.toLocaleString()} words`}
          />
        )}
      </div>
      {target.warning_level === "approaching" && (
        <p className={styles.warningMsg}>
          Approaching the upper end of this form ({target.current.toLocaleString()} /{" "}
          {target.max.toLocaleString()} words).
          {next && ` Consider whether this is trending toward a ${next}.`}
        </p>
      )}
      {target.warning_level === "exceeded" && (
        <p className={`${styles.warningMsg} ${styles.exceeded}`}>
          Exceeded the {intendedLength.replace("_", " ")} ceiling ({target.current.toLocaleString()} words).
          {next &&
            ` This story is now ${next} length — consider updating the intended length in the Lorebook.`}
        </p>
      )}
    </div>
  );
}
