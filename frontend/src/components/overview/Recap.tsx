import { Compass, RefreshCw } from "lucide-react";
import type { RecapState } from "./useRecap";
import styles from "./Overview.module.css";

/** The trigger sits with the hero's other links (doc 14 review), not loose in the page. */
export function RecapTrigger({ recap }: { recap: RecapState }) {
  return (
    <button type="button" className={styles.heroAction} data-tone="ai" onClick={recap.fetch}>
      <Compass size={12} aria-hidden /> Remind me where I left off
    </button>
  );
}

export function RecapCard({ recap }: { recap: RecapState }) {
  if (!recap.text && !recap.loading) return null;
  return (
    <div className={styles.recapCard}>
      <div className={styles.recapHead}>
        <Compass size={12} aria-hidden />
        <span className={styles.label} data-tone="ai">
          Last session
        </span>
        {recap.done && (
          <button type="button" className={styles.iconBtn} onClick={recap.fetch} aria-label="Recap again">
            <RefreshCw size={11} />
          </button>
        )}
      </div>
      <p className={styles.recapText}>
        {recap.text}
        {recap.loading && <span className={styles.recapCursor} />}
      </p>
    </div>
  );
}
