import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, Plus } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import { sceneLeaves } from "../../lib/planning/methods";
import { addPlannedScene } from "../../lib/planning/plannedScene";
import { findNode } from "../layout/structureTreeMeta";
import { useAutosaveField } from "./useAutosaveField";
import styles from "./Plan.module.css";

/** "Act 1 › Chapter 2": where a scene sits, for the group headings. */
function placeOf(tree: StructureNode[], scene: StructureNode): string {
  const parts: string[] = [];
  let at = scene.parent_id ? findNode(tree, scene.parent_id) : undefined;
  while (at) {
    parts.unshift(at.title);
    at = at.parent_id ? findNode(tree, at.parent_id) : undefined;
  }
  return parts.join(" › ");
}

/**
 * The scene list: one line per scene, saying what happens. Every row is a real scene in
 * the structure tree, marked planned until it has prose, so the plan becomes the book.
 */
export default function SceneListStep({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const { structure, activeTemplate } = useStoryStore();
  const scenes = sceneLeaves(structure, activeTemplate);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const deepest = activeTemplate && !activeTemplate.flat ? activeTemplate.levels.length - 1 : 0;
  const levelName = activeTemplate?.levels[deepest]?.name ?? "Scene";

  async function addScene() {
    setAdding(true);
    setHint(null);
    try {
      const result = await addPlannedScene(storyId);
      if ("hint" in result) setHint(result.hint);
      else setFocusId(result.node.id);
    } finally {
      setAdding(false);
    }
  }

  const clearFocus = useCallback(() => setFocusId(null), []);

  const places = scenes.map((scene) => placeOf(structure, scene));
  return (
    <div className={styles.stepBody}>
      {scenes.length === 0 && (
        <p className={styles.quiet}>
          No scenes yet. Add the first one and say in a line what happens; press Enter to add the next.
        </p>
      )}
      <ol className={styles.sceneList}>
        {scenes.map((scene, i) => {
          const heading = places[i] && places[i] !== places[i - 1] ? places[i] : null;
          return (
            <li key={scene.id} className={styles.sceneItem}>
              {heading && <div className={styles.sceneGroup}>{heading}</div>}
              <SceneRow
                scene={scene}
                number={i + 1}
                autoFocus={scene.id === focusId}
                onFocused={clearFocus}
                onOpen={() => navigate(`/stories/${storyId}/write?node=${scene.id}`)}
                onEnterAtEnd={i === scenes.length - 1 ? addScene : undefined}
              />
            </li>
          );
        })}
      </ol>
      <button className={styles.addRow} onClick={addScene} disabled={adding}>
        <Plus size={13} />
        Add {levelName.toLowerCase()}
      </button>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

interface RowProps {
  scene: StructureNode;
  number: number;
  autoFocus: boolean;
  /** A new scene's title is selected once, so typing replaces "Scene 4". */
  onFocused: () => void;
  onOpen: () => void;
  onEnterAtEnd?: () => void;
}

function SceneRow({ scene, number, autoFocus, onFocused, onOpen, onEnterAtEnd }: RowProps) {
  const patchNode = useStoryStore((s) => s.patchNode);
  const save = (field: "title" | "synopsis") => async (value: string) => {
    const updated = await api.updateNode(scene.id, { [field]: value });
    patchNode(scene.id, { [field]: updated[field], updated_at: updated.updated_at });
  };
  const title = useAutosaveField(scene.title, save("title"));
  const synopsis = useAutosaveField(scene.synopsis ?? "", save("synopsis"));
  // The row mounts while the store updates, before the list knows it is the new one, so
  // focus follows the flag rather than autoFocus (which only acts at mount).
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus || !titleRef.current) return;
    titleRef.current.focus();
    titleRef.current.select();
    onFocused();
  }, [autoFocus, onFocused]);
  // One line when empty, as tall as its text otherwise, without a scrollbar.
  const synopsisRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = synopsisRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [synopsis.value]);

  const state =
    scene.word_count > 0
      ? `${scene.word_count.toLocaleString()} words`
      : scene.status === "planned"
        ? "Planned"
        : "Empty";

  return (
    <div className={`${styles.sceneRow} ${scene.status === "planned" ? styles.scenePlanned : ""}`}>
      <span className={styles.sceneNum}>{number}</span>
      <div className={styles.sceneMain}>
        <input
          className={styles.sceneTitle}
          value={title.value}
          onChange={(e) => title.change(e.target.value)}
          onBlur={title.flush}
          ref={titleRef}
          aria-label={`Scene ${number} title`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget.nextElementSibling as HTMLTextAreaElement | null)?.focus();
            }
          }}
        />
        <textarea
          ref={synopsisRef}
          className={styles.sceneSynopsis}
          value={synopsis.value}
          onChange={(e) => synopsis.change(e.target.value)}
          onBlur={synopsis.flush}
          rows={1}
          placeholder="What happens in this scene?"
          aria-label={`Scene ${number}: what happens`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && onEnterAtEnd) {
              e.preventDefault();
              synopsis.flush();
              onEnterAtEnd();
            }
          }}
        />
      </div>
      <span className={styles.sceneState}>{state}</span>
      <button
        className={styles.iconBtn}
        onClick={onOpen}
        title="Write this scene"
        aria-label={`Write ${scene.title}`}
      >
        <PenLine size={14} />
      </button>
    </div>
  );
}
