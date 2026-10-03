import { useState } from "react";
import { X } from "lucide-react";
import type { InlineNotesState } from "../useInlineNotes";
import type { Note, NoteKind } from "../../../types/notes";
import { SHORTCUTS, formatCombo } from "../../../lib/keyboard/shortcuts";
import { KIND_LABEL } from "../../notes/kinds";
import styles from "./SceneNotesField.module.css";

const ADDABLE: NoteKind[] = ["note", "question", "todo"];

/**
 * Notes on this scene (doc 15 N1): every note, question and to-do tied to the scene,
 * whether to a passage (it opens in the margin) or to the scene as a whole.
 */
export default function SceneNotesField({
  notes,
  bare = false,
}: {
  notes: InlineNotesState;
  /** Inside a fold that already says "Notes": no heading of its own. */
  bare?: boolean;
}) {
  const [kind, setKind] = useState<NoteKind>("note");
  const [text, setText] = useState("");
  const rows = notes.sceneNotes.filter((n) => !(notes.hideEditorial && n.source?.startsWith("editorial-")));
  const hasEditorial = notes.sceneNotes.some((n) => n.source?.startsWith("editorial-"));

  return (
    <section className={styles.field} aria-label="Notes on this scene">
      <div className={styles.head}>
        {!bare && <h3 className={styles.label}>Notes on this scene</h3>}
        {hasEditorial && (
          <button type="button" className={styles.toggle} onClick={() => notes.setHideEditorial((s) => !s)}>
            {notes.hideEditorial ? "Show" : "Hide"} editorial
          </button>
        )}
      </div>
      <form
        className={styles.add}
        onSubmit={(e) => {
          e.preventDefault();
          void notes.addToScene(kind, text);
          setText("");
        }}
      >
        <div className={styles.kinds} role="radiogroup" aria-label="Kind">
          {ADDABLE.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              className={styles.kindBtn}
              data-kind={k}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Add a ${KIND_LABEL[kind].toLowerCase()} on this scene… (Enter)`}
          aria-label={`New ${KIND_LABEL[kind].toLowerCase()}`}
        />
      </form>
      {rows.length === 0 ? (
        <p className={styles.hint}>
          Nothing yet. Select words in the prose to tie one to them ({formatCombo(SHORTCUTS.inlineNote.combo)}
          ).
        </p>
      ) : (
        <>
          <ul className={styles.list}>
            {rows
              .filter((n) => !n.done)
              .map((n) => (
                <Row key={n.id} note={n} notes={notes} />
              ))}
          </ul>
          {rows.some((n) => n.done) && (
            <>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={notes.showResolved}
                onClick={() => notes.setShowResolved((s) => !s)}
              >
                {notes.showResolved ? "Hide" : "Show"} resolved ({rows.filter((n) => n.done).length})
              </button>
              {notes.showResolved && (
                <ul className={styles.list}>
                  {rows
                    .filter((n) => n.done)
                    .map((n) => (
                      <Row key={n.id} note={n} notes={notes} />
                    ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Row({ note, notes }: { note: Note; notes: InlineNotesState }) {
  const editorial = note.source?.startsWith("editorial-");
  return (
    <li className={styles.row} data-kind={note.kind} data-done={note.done || undefined}>
      {note.kind === "todo" ? (
        <input
          type="checkbox"
          className={styles.check}
          checked={note.done}
          onChange={(e) => void notes.change(note.id, { done: e.target.checked })}
          aria-label={note.done ? "Mark not done" : "Mark done"}
        />
      ) : (
        <span className={styles.dot} aria-hidden />
      )}
      <span className={styles.body}>
        <span className={styles.kind}>
          {editorial ? (note.category ?? "Editorial") : KIND_LABEL[note.kind]}
        </span>
        <span className={styles.text}>{note.content}</span>
        {note.kind === "question" && note.answer && <span className={styles.answer}>{note.answer}</span>}
        {note.anchor && (
          <button type="button" className={styles.anchor} onClick={() => notes.scrollTo(note.id)}>
            “{note.anchor.length > 48 ? `${note.anchor.slice(0, 48)}…` : note.anchor}”
          </button>
        )}
        {notes.lostIds.includes(note.id) && (
          <span className={styles.lost}>Those words have changed, so it is not in the margin.</span>
        )}
      </span>
      {note.kind !== "todo" && (
        <button
          type="button"
          className={styles.resolve}
          onClick={() => void notes.change(note.id, { done: !note.done })}
          title={note.done ? "Reopen" : "Resolve: done with it"}
        >
          {note.done ? "Reopen" : "Resolve"}
        </button>
      )}
      <button
        type="button"
        className={styles.remove}
        onClick={() => void notes.remove(note.id)}
        aria-label={`Delete this ${KIND_LABEL[note.kind].toLowerCase()}`}
        title="Delete"
      >
        <X size={11} />
      </button>
    </li>
  );
}
