import type { AutosaveState } from "./useSceneAutosave";
import styles from "./DraftBanner.module.css";

/** Banner above the editor when a local draft newer than the saved scene exists. */
export default function DraftBanner({ autosave }: { autosave: AutosaveState }) {
  const draft = autosave.pendingDraft;
  if (!draft) return null;
  // eslint-disable-next-line no-restricted-syntax -- savedAt is Date.now() from this browser, not the API
  const savedAt = new Date(draft.savedAt).toLocaleString();
  return (
    <div className={styles.banner} role="status">
      <span>
        An unsaved draft from {savedAt} was found for this segment (a tab closed before saving, or the server
        was unreachable).
      </span>
      <button className={styles.btn} onClick={autosave.restoreDraft}>
        Restore draft
      </button>
      <button className={styles.btn} onClick={autosave.discardDraft}>
        Discard
      </button>
    </div>
  );
}
