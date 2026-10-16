import { Link } from "react-router-dom";
import { useTipStore } from "../../stores/tipStore";
import { useProseViewStore } from "../../stores/proseViewStore";
import styles from "../../pages/Settings.module.css";

/**
 * Help while writing (doc 26, P4): the tips by the status corner that name a quicker way when
 * something was done the long way, two a session at most. On until the writer turns them off.
 * And how the prose shows its dialogue (2026-10-16): colored by speaker, and its tags hidden
 * until the caret is in the line, both off until chosen.
 */
export default function WritingSection() {
  const on = useTipStore((s) => s.on);
  const setOn = useTipStore((s) => s.setOn);
  const speakerColors = useProseViewStore((s) => s.speakerColors);
  const setSpeakerColors = useProseViewStore((s) => s.setSpeakerColors);
  const hideSpeakerTags = useProseViewStore((s) => s.hideSpeakerTags);
  const setHideSpeakerTags = useProseViewStore((s) => s.setHideSpeakerTags);
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
      <label className={styles.toggleRow}>
        <div className={styles.toggleLabel}>
          <span className={styles.label}>Color dialogue by speaker</span>
          <span className={styles.toggleHint}>
            In the prose, a line someone says sits on a soft tint of their color, the one on their tab and the
            strip, with a line under it. It follows the <code>&lt;Name&gt;</code> after a quote, or who
            LoreStudio worked out is speaking. A line with no speaker stays as it is.
          </span>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            aria-label="Color dialogue by speaker"
            checked={speakerColors}
            onChange={(e) => setSpeakerColors(e.target.checked)}
          />
          <span className={styles.toggleTrack} />
        </label>
      </label>
      <label className={styles.toggleRow}>
        <div className={styles.toggleLabel}>
          <span className={styles.label}>Hide speaker tags</span>
          <span className={styles.toggleHint}>
            The <code>&lt;Name&gt;</code> after a quote stays out of sight while you write, and shows again
            while the cursor is in that line, so you can see and change it. Point at a line to see who says
            it. A tag that names nobody always shows. Nothing in the text changes.
          </span>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            aria-label="Hide speaker tags"
            checked={hideSpeakerTags}
            onChange={(e) => setHideSpeakerTags(e.target.checked)}
          />
          <span className={styles.toggleTrack} />
        </label>
      </label>
    </div>
  );
}
