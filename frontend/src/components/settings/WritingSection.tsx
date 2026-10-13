import { Link } from "react-router-dom";
import { useTipStore } from "../../stores/tipStore";
import styles from "../../pages/Settings.module.css";

/**
 * Help while writing (doc 26, P4): the tips by the status corner that name a quicker way when
 * something was done the long way, two a session at most. On until the writer turns them off.
 */
export default function WritingSection() {
  const on = useTipStore((s) => s.on);
  const setOn = useTipStore((s) => s.setOn);
  return (
    <div className={styles.card}>
      <label className={styles.toggleRow}>
        <div className={styles.toggleLabel}>
          <span className={styles.label}>Typing tips</span>
          <span className={styles.toggleHint}>
            When you do something the long way, a line by the word count names the quicker way, at a pause and
            twice a session at most. An empty scene names one too. Every one is in{" "}
            <Link to="/guides/typing">What you can type</Link>.
          </span>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            aria-label="Typing tips"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
          />
          <span className={styles.toggleTrack} />
        </label>
      </label>
    </div>
  );
}
