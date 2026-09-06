import { Redo2, Undo2 } from "lucide-react";
import type { UndoRedoState } from "../../hooks/useUndoRedo";
import styles from "./GlobalHeader.module.css";

const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
const mod = isMac ? "⌘" : "Ctrl+";

export default function UndoRedoButtons({ undoRedo }: { undoRedo: UndoRedoState }) {
  const { canUndo, canRedo, undoLabel, redoLabel, busy, error, clearError } = undoRedo;
  return (
    <div className={styles.undoGroup}>
      <button
        className={styles.iconBtn}
        onClick={undoRedo.undo}
        disabled={!canUndo || busy}
        title={canUndo ? `Undo: ${undoLabel} (${mod}Z)` : "Nothing to undo"}
        aria-label={canUndo ? `Undo ${undoLabel}` : "Undo"}
      >
        <Undo2 size={14} />
      </button>
      <button
        className={styles.iconBtn}
        onClick={undoRedo.redo}
        disabled={!canRedo || busy}
        title={canRedo ? `Redo: ${redoLabel} (${mod}⇧Z)` : "Nothing to redo"}
        aria-label={canRedo ? `Redo ${redoLabel}` : "Redo"}
      >
        <Redo2 size={14} />
      </button>
      {error && (
        <button className={styles.undoError} onClick={clearError} title="Dismiss">
          {error}
        </button>
      )}
    </div>
  );
}
