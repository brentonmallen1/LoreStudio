import { useState } from "react";
import type { NoteKind } from "../../types/notes";
import { KIND_LABEL } from "./kinds";
import styles from "./Notes.module.css";

/** Write a note of a kind (doc 15): the kinds as chips over one line, Enter keeps it. */
export default function NoteComposer({
  kinds,
  initial,
  onAdd,
  where,
}: {
  kinds: NoteKind[];
  initial?: NoteKind;
  onAdd: (kind: NoteKind, text: string) => void;
  /** Ends the placeholder: "… about Thomas", "… on this scene". */
  where?: string;
}) {
  const [kind, setKind] = useState<NoteKind>(initial ?? kinds[0]);
  const [text, setText] = useState("");
  const noun = KIND_LABEL[kind].toLowerCase();
  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(kind, text);
        setText("");
      }}
    >
      <div className={styles.kinds} role="radiogroup" aria-label="Kind">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={styles.kindChip}
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
        placeholder={`Add ${kind === "idea" ? "an" : "a"} ${noun}${where ? ` ${where}` : ""}… (Enter)`}
        aria-label={`New ${noun}`}
      />
    </form>
  );
}
