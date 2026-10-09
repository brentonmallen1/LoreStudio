import { useState } from "react";
import type { NoteFilter } from "../../types/notes";
import NoteComposer from "./NoteComposer";
import NoteItem from "./NoteItem";
import { useStoryNotes } from "./useStoryNotes";
import styles from "./Notes.module.css";

/**
 * The notes about one character or place, on their sheet (doc 15 N2): what is open first,
 * what is answered or done folded under it.
 */
export default function SubjectNotes({
  storyId,
  aboutType,
  aboutId,
  name,
}: {
  storyId: string;
  aboutType: "character" | "location";
  aboutId: string;
  name: string;
}) {
  const filter: NoteFilter = { about_type: aboutType, about_id: aboutId };
  const notes = useStoryNotes(storyId, filter);
  const [showDone, setShowDone] = useState(false);
  const list = notes.notes ?? [];
  const open = list.filter((n) => !n.done);
  const done = list.filter((n) => n.done);
  return (
    <div className={styles.subject}>
      {open.length > 0 && (
        <ul className={styles.list}>
          {open.map((n) => (
            <NoteItem key={n.id} note={n} notes={notes} />
          ))}
        </ul>
      )}
      <NoteComposer
        kinds={["note", "question", "todo"]}
        where={`about ${name}`}
        onAdd={(kind, content) => void notes.add({ kind, content, about_type: aboutType, about_id: aboutId })}
      />
      {done.length > 0 && (
        <>
          <button type="button" className={styles.textBtn} onClick={() => setShowDone((s) => !s)}>
            {showDone ? "Hide" : "Show"} resolved ({done.length})
          </button>
          {showDone && (
            <ul className={styles.list}>
              {done.map((n) => (
                <NoteItem key={n.id} note={n} notes={notes} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
