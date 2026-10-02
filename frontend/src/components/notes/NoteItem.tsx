import { useState } from "react";
import { X } from "lucide-react";
import { SHORTCUTS, matchesCombo } from "../../lib/keyboard/shortcuts";
import type { Note } from "../../types/notes";
import { KIND_LABEL } from "./kinds";
import TiePicker from "./TiePicker";
import type { StoryNotes } from "./useStoryNotes";
import styles from "./Notes.module.css";

/**
 * One note in a list (doc 15 N2): a to-do's tick box, a question's answer, the passage a
 * margin note is on. The words are edited in place; a click on them starts.
 */
export default function NoteItem({
  note,
  notes,
  showKind = true,
  onOpen,
}: {
  note: Note;
  notes: StoryNotes;
  showKind?: boolean;
  /** Opens where the note is tied (its passage, its scene); absent when it is tied nowhere. */
  onOpen?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.content);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState(note.answer);
  const [tying, setTying] = useState(false);
  const loose = !note.node_id && !note.about_id;
  const editorial = note.source?.startsWith("editorial-");

  function commit() {
    setEditing(false);
    if (text.trim() && text.trim() !== note.content) void notes.change(note.id, { content: text.trim() });
    else setText(note.content);
  }

  function settle() {
    setAnswering(false);
    void notes.change(note.id, { answer: answer.trim(), done: !!answer.trim() });
  }

  return (
    <li className={styles.item} data-kind={note.kind} data-done={note.done || undefined}>
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
      <div className={styles.itemBody}>
        {showKind && (
          <span className={styles.kind}>
            {editorial ? (note.category ?? "Editorial") : KIND_LABEL[note.kind]}
          </span>
        )}
        {editing ? (
          <textarea
            className={styles.editor}
            value={text}
            autoFocus
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (matchesCombo(e, SHORTCUTS.submitText.combo)) commit();
              if (e.key === "Escape") {
                setText(note.content);
                setEditing(false);
              }
            }}
            aria-label="Edit"
          />
        ) : (
          <button type="button" className={styles.text} onClick={() => setEditing(true)} title="Edit">
            {note.content}
          </button>
        )}
        {note.anchor && <span className={styles.anchor}>“{note.anchor}”</span>}
        {note.kind === "question" &&
          (answering ? (
            <textarea
              className={styles.editor}
              value={answer}
              autoFocus
              rows={2}
              placeholder="What you decided…"
              onChange={(e) => setAnswer(e.target.value)}
              onBlur={settle}
              onKeyDown={(e) => {
                if (matchesCombo(e, SHORTCUTS.submitText.combo)) settle();
                if (e.key === "Escape") setAnswering(false);
              }}
              aria-label="Answer"
            />
          ) : note.answer ? (
            <button type="button" className={styles.answer} onClick={() => setAnswering(true)}>
              {note.answer}
            </button>
          ) : null)}
        {tying && (
          <TiePicker
            onClose={() => setTying(false)}
            onTie={(tie) => {
              setTying(false);
              void notes.change(note.id, tie);
            }}
          />
        )}
      </div>
      <div className={styles.itemActions}>
        {note.kind === "question" && !note.answer && !answering && (
          <button type="button" className={styles.textBtn} onClick={() => setAnswering(true)}>
            Answer
          </button>
        )}
        {note.kind !== "todo" && !(note.kind === "question" && !note.answer && !note.done) && (
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => void notes.change(note.id, { done: !note.done })}
            title={note.done ? "Reopen" : "Resolve: done with it"}
          >
            {note.done ? "Reopen" : "Resolve"}
          </button>
        )}
        {loose && !tying && (
          <button type="button" className={styles.textBtn} onClick={() => setTying(true)}>
            Tie to…
          </button>
        )}
        {onOpen && (
          <button type="button" className={styles.textBtn} onClick={onOpen}>
            {note.anchor ? "Show in the prose" : "Open"}
          </button>
        )}
        <button
          type="button"
          className={styles.remove}
          onClick={() => void notes.remove(note.id)}
          aria-label={`Delete this ${KIND_LABEL[note.kind].toLowerCase()}`}
          title="Delete"
        >
          <X size={12} />
        </button>
      </div>
    </li>
  );
}
