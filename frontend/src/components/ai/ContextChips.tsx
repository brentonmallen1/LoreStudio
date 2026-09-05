import { useState, useRef, useEffect } from "react";
import { BookOpen, FileText, User, X, Plus } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import { useAIStore } from "../../stores/aiStore";
import type { SessionContext } from "../../lib/ai/sessionTypes";
import styles from "./ContextChips.module.css";

interface Props {
  sessionId: string;
  context: SessionContext;
  resolvedNames: { storyTitle?: string; nodeName?: string; characterName?: string };
}

function flattenNodes(
  nodes: import("../../types").StructureNode[],
  depth = 0,
): Array<{ id: string; label: string; depth: number }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.title || "(untitled)", depth },
    ...flattenNodes(n.children ?? [], depth + 1),
  ]);
}

export default function ContextChips({ sessionId, context, resolvedNames }: Props) {
  const { updateSessionContext } = useAIStore();
  const { stories, structure, characters } = useStoryStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<"story" | "scene" | "character" | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const flatNodes = flattenNodes(structure);
  const storyCharacters = context.storyId
    ? characters.filter((c) => c.story_id === context.storyId)
    : characters;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setPickerType(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function removeStory() {
    updateSessionContext(sessionId, { storyId: undefined, nodeId: undefined });
  }

  function removeNode() {
    updateSessionContext(sessionId, { nodeId: undefined });
  }

  function removeCharacter() {
    updateSessionContext(sessionId, { characterId: undefined });
  }

  function pickStory(id: string) {
    updateSessionContext(sessionId, { storyId: id, nodeId: undefined, characterId: undefined });
    setPickerOpen(false);
    setPickerType(null);
  }

  function pickNode(id: string) {
    updateSessionContext(sessionId, { nodeId: id });
    setPickerOpen(false);
    setPickerType(null);
  }

  function pickCharacter(id: string) {
    updateSessionContext(sessionId, { characterId: id });
    setPickerOpen(false);
    setPickerType(null);
  }

  function openPicker(type: "story" | "scene" | "character") {
    if (pickerOpen && pickerType === type) {
      setPickerOpen(false);
      setPickerType(null);
    } else {
      setPickerType(type);
      setPickerOpen(true);
    }
  }

  const hasAnyContext = context.storyId || context.nodeId || context.characterId;

  return (
    <div className={styles.container} ref={pickerRef}>
      <div className={styles.chips}>
        {context.storyId && (
          <span className={styles.chip}>
            <BookOpen size={10} className={styles.chipIcon} />
            <span className={styles.chipLabel} title={resolvedNames.storyTitle}>
              {resolvedNames.storyTitle ?? "Story"}
            </span>
            <button className={styles.chipRemove} onClick={removeStory} title="Remove story context">
              <X size={9} />
            </button>
          </span>
        )}
        {context.nodeId && (
          <span className={styles.chip}>
            <FileText size={10} className={styles.chipIcon} />
            <span className={styles.chipLabel} title={resolvedNames.nodeName}>
              {resolvedNames.nodeName ?? "Scene"}
            </span>
            <button className={styles.chipRemove} onClick={removeNode} title="Remove scene context">
              <X size={9} />
            </button>
          </span>
        )}
        {context.characterId && (
          <span className={styles.chip}>
            <User size={10} className={styles.chipIcon} />
            <span className={styles.chipLabel} title={resolvedNames.characterName}>
              {resolvedNames.characterName ?? "Character"}
            </span>
            <button className={styles.chipRemove} onClick={removeCharacter} title="Remove character context">
              <X size={9} />
            </button>
          </span>
        )}

        {/* Add context button */}
        <button
          className={styles.addBtn}
          onClick={() => openPicker(context.storyId ? (context.nodeId ? "character" : "scene") : "story")}
          title="Add context"
        >
          <Plus size={10} />
          {!hasAnyContext && <span>Add context</span>}
        </button>
      </div>

      {pickerOpen && (
        <div className={styles.picker}>
          {/* Tab buttons */}
          <div className={styles.pickerTabs}>
            {!context.storyId && (
              <button
                className={`${styles.pickerTab} ${pickerType === "story" ? styles.pickerTabActive : ""}`}
                onClick={() => setPickerType("story")}
              >
                <BookOpen size={11} /> Story
              </button>
            )}
            {context.storyId && !context.nodeId && (
              <button
                className={`${styles.pickerTab} ${pickerType === "scene" ? styles.pickerTabActive : ""}`}
                onClick={() => setPickerType("scene")}
              >
                <FileText size={11} /> Scene
              </button>
            )}
            {context.storyId && !context.characterId && (
              <button
                className={`${styles.pickerTab} ${pickerType === "character" ? styles.pickerTabActive : ""}`}
                onClick={() => setPickerType("character")}
              >
                <User size={11} /> Character
              </button>
            )}
          </div>

          <div className={styles.pickerList}>
            {pickerType === "story" &&
              stories.map((s) => (
                <button key={s.id} className={styles.pickerItem} onClick={() => pickStory(s.id)}>
                  {s.title}
                </button>
              ))}
            {pickerType === "scene" &&
              flatNodes.map((n) => (
                <button
                  key={n.id}
                  className={styles.pickerItem}
                  style={{ paddingLeft: `${0.6 + n.depth * 0.75}rem` }}
                  onClick={() => pickNode(n.id)}
                >
                  {n.label}
                </button>
              ))}
            {pickerType === "character" &&
              storyCharacters.map((c) => (
                <button key={c.id} className={styles.pickerItem} onClick={() => pickCharacter(c.id)}>
                  {c.name}
                </button>
              ))}
            {((pickerType === "story" && stories.length === 0) ||
              (pickerType === "scene" && flatNodes.length === 0) ||
              (pickerType === "character" && storyCharacters.length === 0)) && (
              <p className={styles.pickerEmpty}>Nothing available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
