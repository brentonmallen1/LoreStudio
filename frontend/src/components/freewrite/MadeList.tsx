import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { flattenStructure } from "../editor/segmentMeta";
import { sectionPath } from "../../lib/routes";
import { useStoryStore } from "../../stores/storyStore";
import NoteItem from "../notes/NoteItem";
import { useStoryNotes } from "../notes/useStoryNotes";
import styles from "./Freewrite.module.css";

/** What the words became, said with where they went (doc 29 D9). */
const MADE_KIND: Record<string, string> = {
  character: "Character",
  place: "Place",
  scene: "Planned scene",
  draft: "Scene, first draft",
  idea: "Idea, not placed yet",
};

const FIELD_LABEL: Record<string, string> = {
  logline: "The logline",
  premise: "The premise",
  conflict: "The central conflict",
};

/**
 * What the Freewrite page has made so far (doc 15 N3), in the order it appears: notes with
 * their tick box, answer and "Tie to…", and links to the characters, places and scenes, each
 * saying where the words went: a planned scene, a scene's first draft, or an idea in the
 * Outline's tray (doc 29 D9).
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
        Nothing made yet. Select a sentence and make it a note, a question, a character, a place or a scene;
        it stays on the page, dotted, and is listed here with where it went.
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
        if (kind === "idea")
          return (
            <li key={ref} className={styles.madeRow}>
              <span className={styles.madeKind}>{MADE_KIND.idea}</span>
              <button
                type="button"
                className={styles.madeLink}
                onClick={() => navigate(`/stories/${storyId}/outline`)}
              >
                In the Outline's tray
              </button>
            </li>
          );
        const scene = kind === "scene" || kind === "draft";
        const target =
          kind === "character"
            ? characters.find((c) => c.id === id)
            : kind === "place"
              ? locations.find((l) => l.id === id)
              : scene
                ? scenes.find((n) => n.id === id)
                : null;
        if (kind === "character" || kind === "place" || scene) {
          if (!target) return <Gone key={ref} what={scene ? "A scene" : `A ${kind}`} />;
          const name = "name" in target ? target.name : target.title;
          const to = scene
            ? `/stories/${storyId}/write/${id}`
            : sectionPath(storyId, "lorebook", kind === "character" ? "characters" : "places", id);
          return (
            <li key={ref} className={styles.madeRow}>
              <span className={styles.madeKind}>{MADE_KIND[kind]}</span>
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
