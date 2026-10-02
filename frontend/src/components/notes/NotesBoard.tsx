import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { flattenStructure } from "../editor/segmentMeta";
import { sceneLeaves } from "../../lib/planning/methods";
import {
  countByKind,
  filterNotes,
  groupNotes,
  type NoteGroup,
  type NoteStatus,
} from "../../lib/notes/grouping";
import { sectionPath } from "../../lib/routes";
import { useStoryStore } from "../../stores/storyStore";
import type { Note, NoteKind } from "../../types/notes";
import PageHeader from "../layout/PageHeader";
import NoteComposer from "./NoteComposer";
import NoteItem from "./NoteItem";
import { useStoryNotes } from "./useStoryNotes";
import styles from "./Notes.module.css";

const KINDS: NoteKind[] = ["note", "question", "todo", "idea"];
const PLURAL: Record<NoteKind, string> = {
  note: "Notes",
  question: "Questions",
  todo: "To-dos",
  idea: "Ideas",
};
const STATUSES: { id: NoteStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "done", label: "Resolved" },
  { id: "all", label: "All" },
];

/**
 * Every note in the story in one list (doc 15 N2): what is not tied anywhere yet, then each
 * scene in reading order, then the people and places they are about. The Compendium's
 * Notes section, and in compact form the side panel's Notes tab (the scene you are in first).
 */
export default function NotesBoard({ compact = false }: { compact?: boolean }) {
  const { activeStory, structure, activeTemplate, characters, locations, activeNode } = useStoryStore();
  const storyId = activeStory?.id;
  const notes = useStoryNotes(storyId);
  const navigate = useNavigate();
  const [kind, setKind] = useState<NoteKind | null>(null);
  const [status, setStatus] = useState<NoteStatus>("open");

  const ctx = useMemo(() => {
    const flat = flattenStructure(structure);
    const title = (id: string | null) => (id ? (flat.find((n) => n.id === id)?.title ?? "") : "");
    return {
      scenes: sceneLeaves(structure, activeTemplate).map((s) => ({
        id: s.id,
        title: s.title,
        parent: title(s.parent_id),
      })),
      characters,
      places: locations,
    };
  }, [structure, activeTemplate, characters, locations]);

  if (!storyId) return null;
  const all = notes.notes ?? [];
  const inStatus = filterNotes(all, null, status);
  const counts = countByKind(inStatus);
  let groups = groupNotes(filterNotes(all, kind ? [kind] : null, status), ctx);
  // Beside the prose, the scene you are in comes first.
  if (compact && activeNode) {
    const here = groups.find((g) => g.key === activeNode.id);
    if (here) groups = [{ ...here, meta: "This scene" }, ...groups.filter((g) => g !== here)];
  }

  function openNote(n: Note, group: NoteGroup) {
    if (!group.to || !storyId) return undefined;
    const to = group.to;
    if (to.kind === "scene")
      return () => navigate(`/stories/${storyId}/write/${to.id}${n.anchor ? `?note=${n.id}` : ""}`);
    return () =>
      navigate(sectionPath(storyId, "lorebook", to.kind === "character" ? "characters" : "places", to.id));
  }

  const chips = (
    <div className={styles.chips} role="radiogroup" aria-label="Show">
      <button
        type="button"
        role="radio"
        aria-checked={kind === null}
        className={styles.filter}
        onClick={() => setKind(null)}
      >
        All <span className={styles.count}>{inStatus.length}</span>
      </button>
      {KINDS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={kind === k}
          className={styles.filter}
          data-kind={k}
          onClick={() => setKind(kind === k ? null : k)}
        >
          {PLURAL[k]} <span className={styles.count}>{counts[k]}</span>
        </button>
      ))}
    </div>
  );
  const statusPick = (
    <select
      className={styles.status}
      value={status}
      onChange={(e) => setStatus(e.target.value as NoteStatus)}
      aria-label="Which"
    >
      {STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
  const body = (
    <>
      <NoteComposer
        kinds={KINDS}
        initial="idea"
        onAdd={(k, content) => void notes.add({ kind: k, content })}
      />

      {notes.notes === null ? null : all.length === 0 ? (
        <p className={styles.empty}>
          No notes yet. Select words in a scene to leave one beside them, or write one here and tie it later.
        </p>
      ) : groups.length === 0 ? (
        <p className={styles.empty}>
          Nothing {status === "done" ? "resolved" : "open"}
          {kind ? ` among the ${PLURAL[kind].toLowerCase()}` : ""}.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className={styles.group} aria-label={g.title}>
            <div className={styles.groupHead}>
              <h3 className={styles.groupTitle}>{g.title}</h3>
              {g.meta && <span className={styles.groupMeta}>{g.meta}</span>}
              {g.to && (
                <button
                  type="button"
                  className={styles.groupGo}
                  onClick={openNote({ anchor: null } as Note, g)}
                  aria-label={`Open ${g.title}`}
                >
                  <ChevronRight size={14} aria-hidden />
                </button>
              )}
            </div>
            <ul className={styles.list}>
              {g.notes.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  notes={notes}
                  showKind={kind === null}
                  onOpen={n.anchor ? openNote(n, g) : undefined}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );

  if (compact)
    return (
      <div className={styles.board} data-compact>
        <div className={styles.filters}>
          {chips}
          {statusPick}
        </div>
        {body}
      </div>
    );
  return (
    <div className={styles.page}>
      <PageHeader
        title="Notes"
        summary="Notes, questions, to-dos and ideas, wherever they are tied"
        chips={chips}
        aside={statusPick}
      />
      <div className={styles.scroll}>
        <div className={styles.column}>
          <div className={styles.board}>{body}</div>
        </div>
      </div>
    </div>
  );
}
