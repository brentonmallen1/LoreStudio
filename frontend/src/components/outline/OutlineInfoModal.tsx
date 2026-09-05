import { X, Snowflake, ListTree } from "lucide-react";
import styles from "./OutlineInfoModal.module.css";

interface Props {
  onClose: () => void;
}

export default function OutlineInfoModal({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Planning Your Story</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.method}>
            <div className={styles.methodHeader}>
              <span className={styles.iconSnowflake}>
                <Snowflake size={16} />
              </span>
              <h3 className={styles.methodTitle}>Snowflake Method</h3>
              <span className={styles.methodTag}>Develop your idea</span>
            </div>
            <p className={styles.methodDesc}>
              The Snowflake Method helps you <strong>discover what your story is</strong>. Starting from a
              single sentence, you expand outward — paragraph, character arcs, full synopsis — until you have
              a deep understanding of every character's motivation and how the story unfolds.
            </p>
            <p className={styles.methodDesc}>
              Use it before you write, when you're still figuring out your story's core.
            </p>
          </div>

          <div className={styles.divider} />

          <div className={styles.method}>
            <div className={styles.methodHeader}>
              <span className={styles.iconList}>
                <ListTree size={16} />
              </span>
              <h3 className={styles.methodTitle}>Beat Sheet Outlines</h3>
              <span className={styles.methodTag}>Structure your plot</span>
            </div>
            <p className={styles.methodDesc}>
              Beat sheets (Save the Cat, Hero's Journey, etc.) help you{" "}
              <strong>place key story moments at the right pacing points</strong>. They're structural
              frameworks — the Midpoint falls at 50%, the All Is Lost at 75% — that give your story a proven
              rhythm.
            </p>
            <p className={styles.methodDesc}>
              Use them to plan scenes once you know what happens. Select a beat sheet in the Lorebook, then
              click <em>"Inject into Outline"</em> to scaffold a new outline from its beats.
            </p>
          </div>

          <div className={styles.together}>
            <p className={styles.togetherText}>
              <strong>They work together:</strong> Use Snowflake to figure out <em>what</em> your story is —
              then use a beat sheet outline to plan <em>where</em> each event falls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
