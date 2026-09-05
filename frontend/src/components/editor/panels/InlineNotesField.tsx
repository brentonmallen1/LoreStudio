import { Plus, X } from "lucide-react";
import type { InlineNotesState } from "../useInlineNotes";
import styles from "../SceneEditor.module.css";

const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

export default function InlineNotesField({ notes }: { notes: InlineNotesState }) {
  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>Inline Notes</label>
        <button
          className={styles.addLinkBtn}
          onClick={notes.triggerAdd}
          title="Select text in the editor, then click to annotate it"
        >
          <Plus size={11} />
          Add Note
        </button>
      </div>
      <div className={styles.noteLegend}>
        <span className={styles.noteLegendItem}>
          <span className={styles.noteLegendDot} />
          Author
        </span>
        <span className={styles.noteLegendItem}>
          <span className={styles.noteLegendDiamond} />
          Editorial
        </span>
        {notes.notes.some((n) => n.type === "editorial") && (
          <button
            className={styles.noteLegendToggle}
            onClick={() => notes.setHideEditorial((s) => !s)}
            title={notes.hideEditorial ? "Show editorial notes" : "Hide editorial notes"}
          >
            {notes.hideEditorial ? "Show" : "Hide"} editorial
          </button>
        )}
      </div>
      {notes.notes.length === 0 ? (
        <p className={styles.overviewHint}>
          Select text in the editor and click Add Note (or press {isMac ? "⌘" : "Ctrl"}+Shift+N).
        </p>
      ) : (
        <div className={styles.inlineNoteList}>
          {notes.notes.map((note) => (
            <div
              key={note.id}
              className={`${styles.inlineNoteItem}${note.type === "editorial" ? ` ${styles.inlineNoteItemEditorial}` : ""}`}
            >
              <button className={styles.inlineNoteContent} onClick={() => notes.scrollTo(note.id)}>
                <span
                  className={
                    note.type === "editorial" ? styles.inlineNoteAnchorEditorial : styles.inlineNoteAnchor
                  }
                >
                  &ldquo;{note.anchor.length > 35 ? note.anchor.slice(0, 35) + "…" : note.anchor}&rdquo;
                </span>
                {note.note && (
                  <span className={styles.inlineNoteText}>
                    {note.note.length > 60 ? note.note.slice(0, 60) + "…" : note.note}
                  </span>
                )}
              </button>
              <button
                className={styles.linkChipDelete}
                onClick={() => notes.remove(note.id)}
                title="Delete note"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
