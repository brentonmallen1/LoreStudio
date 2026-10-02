import { useEffect, useRef, useState } from "react";
import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import type { InlineNote } from "../../types";
import type { NoteKind } from "../../types/notes";
import { KIND_LABEL } from "../notes/kinds";
import type { InlineNotesState } from "./useInlineNotes";
import styles from "./NoteMargin.module.css";

const MARGIN_KINDS: NoteKind[] = ["note", "question", "todo"];

/**
 * One note in the margin (doc 13 P2; kinds from doc 15 N1). A to-do has its tick box, a
 * question its answer; the open card can change what the note is.
 */
export function NoteCard({
  note,
  notes,
  active,
  lit,
  floating,
  style,
  cardRef,
  onHover,
}: {
  note: InlineNote;
  notes: InlineNotesState;
  active: boolean;
  lit?: boolean;
  floating?: boolean;
  style: React.CSSProperties;
  cardRef?: (el: HTMLDivElement | null) => void;
  onHover: (id: string | null) => void;
}) {
  const { popover } = notes;
  const editing = active && popover.open && !popover.isNew && popover.isEditing;
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const editorial = note.type === "editorial";
  const open = () =>
    notes.setPopover({ open: true, isNew: false, noteId: note.id, rect: null, isEditing: false });
  return (
    <div
      ref={cardRef}
      data-card-id={note.id}
      className={styles.card}
      data-kind={note.kind}
      data-active={active || undefined}
      data-lit={lit || undefined}
      data-floating={floating || undefined}
      data-editorial={editorial || undefined}
      data-done={note.done || undefined}
      style={style}
      onMouseEnter={() => onHover(note.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => !active && open()}
    >
      <div className={styles.cardHead}>
        <span className={styles.kind}>
          {editorial ? (note.category ?? "Editorial") : KIND_LABEL[note.kind]}
        </span>
        {active && !editing && (
          <span className={styles.actions}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Edit"
              aria-label="Edit"
              onClick={() => {
                notes.setEditText(note.note);
                if (popover.open && !popover.isNew) notes.setPopover({ ...popover, isEditing: true });
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title={note.done ? "Reopen" : "Resolve: done with it, out of the margin"}
              aria-label={note.done ? "Reopen" : "Resolve"}
              onClick={(e) => {
                e.stopPropagation();
                void notes.change(note.id, { done: !note.done });
                if (!note.done && !notes.showResolved) notes.setPopover({ open: false });
              }}
            >
              {note.done ? <RotateCcw size={12} /> : <Check size={12} />}
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Delete"
              aria-label="Delete"
              onClick={() => void notes.remove(note.id)}
            >
              <Trash2 size={12} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Close (Esc)"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                notes.setPopover({ open: false });
              }}
            >
              <X size={12} />
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <Editor
          value={notes.editText}
          onChange={notes.setEditText}
          onCancel={() =>
            popover.open && !popover.isNew && notes.setPopover({ ...popover, isEditing: false })
          }
          onSave={() => void notes.update(note.id, notes.editText)}
        />
      ) : note.kind === "todo" ? (
        <label className={styles.todo} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={note.done}
            onChange={(e) => void notes.change(note.id, { done: e.target.checked })}
          />
          <span className={styles.text} data-clamped={!active || undefined}>
            {note.note}
          </span>
        </label>
      ) : (
        <p className={styles.text} data-clamped={!active || undefined}>
          {note.note || <em>No note text.</em>}
        </p>
      )}
      {note.kind === "question" && note.answer && !answering && (
        <p className={styles.answer} data-clamped={!active || undefined}>
          {note.answer}
        </p>
      )}
      {active && !editing && note.kind === "question" && !editorial && (
        <div onClick={(e) => e.stopPropagation()}>
          {answering ? (
            <Editor
              value={answer}
              onChange={setAnswer}
              onCancel={() => setAnswering(false)}
              onSave={() => {
                void notes.change(note.id, { answer: answer.trim(), done: true });
                setAnswering(false);
              }}
              placeholder="What you decided…"
              saveLabel="Settle it"
            />
          ) : (
            <button
              type="button"
              className={styles.answerBtn}
              onClick={() => {
                setAnswer(note.answer);
                setAnswering(true);
              }}
            >
              {note.answer ? "Change the answer" : "Answer it"}
            </button>
          )}
        </div>
      )}
      {active && !editing && !editorial && (
        <div className={styles.kindSwitch} role="radiogroup" aria-label="What this is">
          {MARGIN_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={note.kind === k}
              data-kind={k}
              onClick={(e) => {
                e.stopPropagation();
                if (k !== note.kind) void notes.change(note.id, { kind: k });
              }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A note shown, not opened: the dot's preview on hover (doc 15 polish). */
export function NotePeek({ note, style }: { note: InlineNote; style: React.CSSProperties }) {
  const editorial = note.type === "editorial";
  return (
    <div
      className={styles.card}
      data-kind={note.kind}
      data-floating
      data-peek
      data-done={note.done || undefined}
      style={style}
      role="tooltip"
    >
      <div className={styles.cardHead}>
        <span className={styles.kind}>
          {editorial ? (note.category ?? "Editorial") : KIND_LABEL[note.kind]}
        </span>
      </div>
      <p className={styles.text} data-clamped>
        {note.note || <em>No note text.</em>}
      </p>
      {note.kind === "question" && note.answer && (
        <p className={styles.answer} data-clamped>
          {note.answer}
        </p>
      )}
      <span className={styles.peekHint}>Click to open</span>
    </div>
  );
}

export function NewNoteCard({
  notes,
  floating,
  style,
  cardRef,
}: {
  notes: InlineNotesState;
  floating?: boolean;
  style: React.CSSProperties;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const kind = notes.popover.open && notes.popover.isNew ? notes.popover.kind : "note";
  const placeholder = {
    note: "Your note…",
    question: "What is undecided?",
    todo: "What needs doing?",
    idea: "",
  };
  return (
    <div
      ref={cardRef}
      data-card-id="new"
      className={styles.card}
      data-kind={kind}
      data-active
      data-floating={floating || undefined}
      style={style}
    >
      <div className={styles.cardHead}>
        <span className={styles.kind}>New {KIND_LABEL[kind].toLowerCase()}</span>
      </div>
      <Editor
        value={notes.inputText}
        onChange={notes.setInputText}
        onCancel={() => notes.setPopover({ open: false })}
        onSave={() => void notes.save()}
        placeholder={placeholder[kind]}
      />
    </div>
  );
}

function Editor({
  value,
  onChange,
  onCancel,
  onSave,
  placeholder,
  saveLabel = "Save",
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  placeholder?: string;
  saveLabel?: string;
}) {
  // Focus after the editor has finished with the key that opened this (a `/todo` Enter, a
  // shortcut): autoFocus alone loses to ProseMirror taking focus back.
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <>
      <textarea
        ref={ref}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
        }}
      />
      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.save} onClick={onSave} disabled={!value.trim()}>
          {saveLabel}
        </button>
      </div>
    </>
  );
}
