import type { RefObject } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import type { InlineNotesState } from "./useInlineNotes";
import styles from "./SceneEditor.module.css";

export default function InlineNotePopover({
  notes,
  popoverRef,
}: {
  notes: InlineNotesState;
  popoverRef: RefObject<HTMLDivElement | null>;
}) {
  const { popover } = notes;
  if (!popover.open) return null;
  const rect = popover.rect;
  const top = rect ? Math.min(rect.bottom + 8, window.innerHeight - 220) : window.innerHeight / 2 - 80;
  const left = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - 296)) : window.innerWidth / 2 - 140;
  const existing = !popover.isNew ? notes.notes.find((n) => n.id === popover.noteId) : undefined;
  const isEditing = !popover.isNew && popover.isEditing;

  return (
    <div ref={popoverRef} className={styles.notePopover} style={{ top, left }}>
      <div className={styles.notePopoverHeader}>
        <span className={styles.notePopoverTitle}>{popover.isNew ? "Add Note" : "Author Note"}</span>
        <div className={styles.notePopoverActions}>
          {!popover.isNew && !popover.isEditing && (
            <button
              className={styles.notePopoverEdit}
              onClick={() => {
                notes.setEditText(existing?.note ?? "");
                notes.setPopover({ ...popover, isEditing: true });
              }}
              title="Edit note"
            >
              <Pencil size={12} />
            </button>
          )}
          {!popover.isNew && (
            <button
              className={styles.notePopoverDelete}
              onClick={() => notes.remove(popover.noteId)}
              title="Delete note"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button className={styles.notePopoverClose} onClick={() => notes.setPopover({ open: false })}>
            <X size={13} />
          </button>
        </div>
      </div>
      <div className={styles.notePopoverBody}>
        <p className={styles.notePopoverAnchor}>
          &ldquo;{popover.isNew ? popover.anchor : existing?.anchor}&rdquo;
        </p>
        {popover.isNew ? (
          <textarea
            className={styles.notePopoverInput}
            value={notes.inputText}
            onChange={(e) => notes.setInputText(e.target.value)}
            placeholder="Your note…"
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") notes.setPopover({ open: false });
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) notes.save();
            }}
          />
        ) : isEditing ? (
          <textarea
            className={styles.notePopoverInput}
            value={notes.editText}
            onChange={(e) => notes.setEditText(e.target.value)}
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") notes.setPopover({ ...popover, isEditing: false });
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) notes.update(popover.noteId, notes.editText);
            }}
          />
        ) : (
          <p className={styles.notePopoverNoteText}>{existing?.note || <em>No note text.</em>}</p>
        )}
      </div>
      {(popover.isNew || isEditing) && (
        <div className={styles.notePopoverFooter}>
          <button
            className={styles.modalCancel}
            onClick={() =>
              popover.isNew
                ? notes.setPopover({ open: false })
                : notes.setPopover({ ...popover, isEditing: false })
            }
          >
            Cancel
          </button>
          <button
            className={styles.modalSave}
            onClick={() => (popover.isNew ? notes.save() : notes.update(popover.noteId, notes.editText))}
            disabled={popover.isNew ? !notes.inputText.trim() : !notes.editText.trim()}
          >
            Save Note
          </button>
        </div>
      )}
    </div>
  );
}
