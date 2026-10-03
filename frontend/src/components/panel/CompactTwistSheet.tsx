import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { openScene, sceneTitle } from "../../lib/panel/openScene";
import { cluesLine, statusLabel, typeLabel } from "../../lib/twists/labels";
import type { Twist } from "../../types";
import styles from "./Panel.module.css";

/** A twist beside the prose: the truth, the misdirection, and where it lands. Read here;
 * written on its Lorebook sheet. */
export default function CompactTwistSheet({ storyId, twistId }: { storyId: string; twistId: string }) {
  const [twist, setTwist] = useState<Twist | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    api
      .listTwists(storyId)
      .then((all) => setTwist(all.find((t) => t.id === twistId) ?? null))
      .catch(() => setTwist(null));
  }, [storyId, twistId, version]);
  useReloadOnUndo(["twist"], () => setVersion((v) => v + 1));

  if (twist === undefined) return <p className={`${styles.section} ${styles.empty}`}>Loading…</p>;
  if (twist === null) return <p className={`${styles.section} ${styles.empty}`}>This twist is gone.</p>;
  return (
    <section className={styles.section}>
      <p className={styles.sub}>
        {typeLabel(twist.twist_type)} · {statusLabel(twist.status)}
      </p>
      <div className={styles.field}>
        <span className={styles.label}>The truth</span>
        <p className={styles.text}>{twist.the_truth || "Not written yet."}</p>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>The misdirection</span>
        <p className={styles.text}>{twist.the_misdirection || "Not written yet."}</p>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Clues</span>
        <p className={styles.text}>
          {twist.clues.length === 0 ? "None planted yet." : `${cluesLine(twist)}.`}
        </p>
      </div>
      {twist.revealed_at_node_id && (
        <div className={styles.field}>
          <span className={styles.label}>Revealed in</span>
          <div className={styles.chips}>
            <button className={styles.chip} onClick={() => openScene(twist.revealed_at_node_id!)}>
              {sceneTitle(twist.revealed_at_node_id)}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
