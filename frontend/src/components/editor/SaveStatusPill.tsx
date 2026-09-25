import type { AutosaveState } from "./useSceneAutosave";
import styles from "./SceneEditor.module.css";

const LABELS: Record<AutosaveState["saveState"], string> = {
  idle: "Saved",
  unsaved: "Unsaved",
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline · retrying",
  conflict: "Conflict",
};

const TITLES: Record<AutosaveState["saveState"], string> = {
  idle: "All changes are saved",
  unsaved: "Changes not yet saved (autosave in ~1s)",
  saving: "Saving…",
  saved: "Saved",
  offline: "The server could not be reached. Your text is kept locally and the save will be retried.",
  conflict: "This segment changed elsewhere (another tab, an undo, a restore). Choose which version to keep.",
};

/** Autosave status in the topbar: a dot plus a word, and conflict actions when needed. */
export default function SaveStatusPill({ autosave }: { autosave: AutosaveState }) {
  const { saveState } = autosave;
  return (
    <span
      className={`${styles.savePill} ${styles[`savePill_${saveState}`]}`}
      title={TITLES[saveState]}
      role="status"
    >
      <span className={`${styles.saveIndicator} ${styles[`saveIndicator_${saveState}`]}`} />
      <span className={styles.savePillText}>{LABELS[saveState]}</span>
      {saveState === "conflict" && (
        <span className={styles.conflictActions}>
          <button
            className={styles.conflictBtn}
            onClick={autosave.keepMine}
            title="Overwrite the server with this editor's text"
          >
            Keep mine
          </button>
          <button
            className={styles.conflictBtn}
            onClick={autosave.takeTheirs}
            title="Load the other version and drop these edits"
          >
            Take theirs
          </button>
        </span>
      )}
    </span>
  );
}

/** Banner above the editor when a local draft newer than the saved scene exists. */
export function DraftBanner({ autosave }: { autosave: AutosaveState }) {
  const draft = autosave.pendingDraft;
  if (!draft) return null;
  // eslint-disable-next-line no-restricted-syntax -- savedAt is Date.now() from this browser, not the API
  const savedAt = new Date(draft.savedAt).toLocaleString();
  return (
    <div className={styles.draftBanner} role="status">
      <span>
        An unsaved draft from {savedAt} was found for this segment (a tab closed before saving, or the server
        was unreachable).
      </span>
      <button className={styles.conflictBtn} onClick={autosave.restoreDraft}>
        Restore draft
      </button>
      <button className={styles.conflictBtn} onClick={autosave.discardDraft}>
        Discard
      </button>
    </div>
  );
}
