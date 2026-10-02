import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { flattenStructure } from "../editor/segmentMeta";
import { sectionPath } from "../../lib/routes";
import { useStoryStore } from "../../stores/storyStore";
import NoteItem from "../notes/NoteItem";
import { useStoryNotes } from "../notes/useStoryNotes";
import styles from "./Freewrite.module.css";

const FIELD_LABEL: Record<string, string> = {
  logline: "The logline",
  premise: "The premise",
  conflict: "The central conflict",
};

/**
 * What the Freewrite page has made so far (doc 15 N3), in the order it appears: notes with
 * their tick box, answer and "Tie to…", and links to the characters, places and scenes.
 */
export default function MadeList({ storyId, refs }: { storyId: string; refs: string[] }) {
  const notes = useStoryNotes(storyId);
  const { characters, locations, structure } = useStoryStore();
  const navigate = useNavigate();
  const scenes = flattenStructure(structure);
  // A note made since the list loaded is not in it yet: fetch once more for each such id.
  const asked = useRef(new Set<string>());
  const unknown = notes.notes
    ? refs.filter((r) => r.startsWith("note:") && !notes.notes!.some((n) => `note:${n.id}` === r))
    : [];
  const key = unknown.join(",");
  useEffect(() => {
    const fresh = key.split(",").filter((r) => r && !asked.current.has(r));
    if (!fresh.length) return;
    fresh.forEach((r) => asked.current.add(r));
    void notes.reload();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (refs.length === 0)
    return (
      <p className={styles.madeEmpty}>
        Nothing made yet. Select a sentence and make it a note, a question, a character or a place; it stays
        on the page, dotted.
      </p>
    );
  return (
    <ul className={styles.made}>
      {refs.map((ref) => {
        // "note:<id>", "character:<id>"…, or a field's name alone ("logline").
        const at = ref.indexOf(":");
        const kind = at < 0 ? ref : ref.slice(0, at);
        const id = at < 0 ? "" : ref.slice(at + 1);
        if (kind === "note") {
          const note = notes.notes?.find((n) => n.id === id);
          return note ? <NoteItem key={ref} note={note} notes={notes} /> : <Gone key={ref} what="A note" />;
        }
        const target =
          kind === "character"
            ? characters.find((c) => c.id === id)
            : kind === "place"
              ? locations.find((l) => l.id === id)
              : kind === "scene"
                ? scenes.find((n) => n.id === id)
                : null;
        if (kind === "character" || kind === "place" || kind === "scene") {
          if (!target) return <Gone key={ref} what={`A ${kind}`} />;
          const name = "name" in target ? target.name : target.title;
          const to =
            kind === "scene"
              ? `/stories/${storyId}/write/${id}`
              : sectionPath(storyId, "lorebook", kind === "character" ? "characters" : "places", id);
          return (
            <li key={ref} className={styles.madeRow}>
              <span className={styles.madeKind}>
                {kind === "scene" ? "Scene" : kind === "character" ? "Character" : "Place"}
              </span>
              <button type="button" className={styles.madeLink} onClick={() => navigate(to)}>
                {name}
              </button>
            </li>
          );
        }
        return (
          <li key={ref} className={styles.madeRow}>
            <span className={styles.madeKind}>{ref.startsWith("theme:") ? "Theme" : "Story"}</span>
            <button
              type="button"
              className={styles.madeLink}
              onClick={() => navigate(sectionPath(storyId, "lorebook", "identity"))}
            >
              {ref.startsWith("theme:") ? ref.slice(6) : (FIELD_LABEL[ref] ?? ref)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Gone({ what }: { what: string }) {
  return <li className={styles.madeGone}>{what} made here has since been deleted.</li>;
}
