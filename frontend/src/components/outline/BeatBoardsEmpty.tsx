import { BookOpen, Plus } from "lucide-react";
import Term from "../common/Term";
import styles from "./OutlineManager.module.css";

/** Plan › Boards with no beat board yet: what one is, and how to start. */
export default function BeatBoardsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={styles.managerInner}>
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <BookOpen size={36} />
        </div>
        <p className={styles.emptyTitle}>No beat boards yet</p>
        <p className={styles.emptyDesc}>
          A beat board is a loose outline: jot <Term id="beat">beats</Term>, nest and reorder them, and turn
          any beat into a scene when it's ready. Start blank, or bring in the beats of a{" "}
          <Term id="beat-sheet">beat sheet</Term> from Story Identity.
        </p>
        <button className={styles.addBeatBtnPrimary} onClick={onCreate}>
          <Plus size={14} />
          New beat board
        </button>
      </div>
    </div>
  );
}
