import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Note, NoteKind } from "../../types/notes";
import NoteComposer from "../notes/NoteComposer";
import NoteItem from "../notes/NoteItem";
import { useStoryNotes } from "../notes/useStoryNotes";
import styles from "./SceneSheet.module.css";

/** The kinds in the order a scene's notes are read: what is unresolved first. */
const GROUPS: { kind: NoteKind; label: string }[] = [
  { kind: "question", label: "Questions" },
  { kind: "todo", label: "To-dos" },
  { kind: "note", label: "Notes" },
  { kind: "idea", label: "Ideas" },
];

/**
 * The Scene sheet's Notes page (doc 24, canvas 8e): write first, then every note on the
 * scene grouped by kind, a passage's note quoting its words (a click shows it in the prose),
 * and what is done or answered folded at the foot.
 */
export default function SceneNotes({ storyId, nodeId }: { storyId: string; nodeId: string }) {
  const navigate = useNavigate();
  const notes = useStoryNotes(storyId, { node_id: nodeId });
  const list = notes.notes ?? [];
  const open = list.filter((n) => !n.done);
  const done = list.filter((n) => n.done);
  const show = (n: Note) =>
    n.anchor ? () => navigate(`/stories/${storyId}/write/${nodeId}?note=${n.id}`) : undefined;

  return (
    <div className={styles.notes}>
      <div className={styles.box}>
        <NoteComposer
          kinds={["note", "question", "todo"]}
          where="on this scene"
          onAdd={(kind, content) => void notes.add({ kind, content, node_id: nodeId })}
        />
      </div>

      {notes.notes && open.length === 0 && (
        <p className={styles.muted}>
          Nothing open on this scene. Notes on a passage are made in the prose’s margin.
        </p>
      )}

      {GROUPS.map(({ kind, label }) => {
        const rows = open.filter((n) => n.kind === kind);
        if (!rows.length) return null;
        return (
          <section key={kind} className={styles.part} aria-label={label}>
            <h3 className={styles.label}>
              {label} · {rows.length}
            </h3>
            <ul className={styles.noteList}>
              {rows.map((n) => (
                <NoteItem key={n.id} note={n} notes={notes} showKind={false} onOpen={show(n)} />
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <details className={styles.around}>
          <summary className={styles.aroundHead}>
            <ChevronRight size={14} className={styles.aroundChevron} aria-hidden />
            Done and answered · {done.length}
          </summary>
          <ul className={styles.noteList}>
            {done.map((n) => (
              <NoteItem key={n.id} note={n} notes={notes} onOpen={show(n)} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
