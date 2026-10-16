import { Orbit } from "lucide-react";
import KeptAnswerBar from "../ai/kept/KeptAnswerBar";
import type { RecapState } from "./useRecap";
import styles from "./Overview.module.css";

/** The trigger sits with the hero's other links (doc 14 review), not loose in the page. */
export function RecapTrigger({ recap }: { recap: RecapState }) {
  return (
    <button type="button" className={styles.heroAction} data-ai onClick={recap.fetch}>
      <Orbit size={12} aria-hidden /> Remind me where I left off
    </button>
  );
}

/** The last recap, kept on the story (A7): there when the Overview opens again, until cleared. */
export function RecapCard({ recap }: { recap: RecapState }) {
  const kept = typeof recap.kept?.data.text === "string" ? recap.kept.data.text : "";
  const text = recap.loading || recap.text ? recap.text : kept;
  if (!text && !recap.loading) return null;
  return (
    <div className={styles.recapCard}>
      <div className={styles.recapHead}>
        <Orbit size={12} aria-hidden />
        <span className={styles.label} data-tone="ai">
          Last session
        </span>
      </div>
      <p className={styles.recapText}>
        {text}
        {recap.loading && <span className={styles.recapCursor} />}
      </p>
      {recap.kept && !recap.text && (
        <div className={styles.recapBar}>
          <KeptAnswerBar
            answer={recap.kept}
            heading="Where I left off"
            context={{ storyId: recap.storyId }}
            onAskAgain={recap.fetch}
            asking={recap.loading}
            onClear={recap.clear}
          />
        </div>
      )}
    </div>
  );
}
