import { useMemo, useState } from "react";
import { flattenStructure } from "../editor/segmentMeta";
import { sceneLeaves } from "../../lib/planning/methods";
import { useStoryStore } from "../../stores/storyStore";
import type { NoteUpdate } from "../../types/notes";
import styles from "./Notes.module.css";

interface Choice {
  key: string;
  label: string;
  meta: string;
  tie: NoteUpdate;
}

/** Tie a loose note to a scene, a character or a place (doc 15 N2): type to find it. */
export default function TiePicker({
  onTie,
  onClose,
}: {
  onTie: (tie: NoteUpdate) => void;
  onClose: () => void;
}) {
  const { structure, activeTemplate, characters, locations } = useStoryStore();
  const [query, setQuery] = useState("");
  const choices = useMemo<Choice[]>(() => {
    const flat = flattenStructure(structure);
    const parent = (id: string | null) => (id ? (flat.find((n) => n.id === id)?.title ?? "") : "");
    return [
      ...sceneLeaves(structure, activeTemplate).map((s) => ({
        key: s.id,
        label: s.title || "Untitled scene",
        meta: parent(s.parent_id) || "scene",
        tie: { node_id: s.id, about_type: null, about_id: null },
      })),
      ...characters.map((c) => ({
        key: c.id,
        label: c.name,
        meta: "character",
        tie: { node_id: null, about_type: "character" as const, about_id: c.id },
      })),
      ...locations.map((l) => ({
        key: l.id,
        label: l.name,
        meta: "place",
        tie: { node_id: null, about_type: "location" as const, about_id: l.id },
      })),
    ];
  }, [structure, activeTemplate, characters, locations]);
  const q = query.trim().toLowerCase();
  const shown = (q ? choices.filter((c) => `${c.label} ${c.meta}`.toLowerCase().includes(q)) : choices).slice(
    0,
    8,
  );
  return (
    <div className={styles.tie}>
      <input
        className={styles.input}
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && shown[0]) {
            e.preventDefault();
            onTie(shown[0].tie);
          }
        }}
        placeholder="A scene, a character or a place…"
        aria-label="Tie to"
      />
      <ul className={styles.tieList} role="listbox" aria-label="Tie to">
        {shown.map((c) => (
          <li key={c.key}>
            <button type="button" role="option" aria-selected={false} onClick={() => onTie(c.tie)}>
              <span>{c.label}</span>
              <span className={styles.tieMeta}>{c.meta}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className={styles.tieNone}>Nothing by that name.</li>}
      </ul>
    </div>
  );
}
