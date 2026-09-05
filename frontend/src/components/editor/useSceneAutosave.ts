import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useDiscoveryStore } from "../../stores/discoveryStore";
import { countWordsClean } from "./segmentMeta";

export type SaveState = "idle" | "unsaved" | "saving" | "saved";

const SAVE_DEBOUNCE_MS = 1200;
const SAVED_FLASH_MS = 2000;

/**
 * Debounced content autosave and live word count for the active node.
 *
 * `handleUpdate` is wired into TipTap's `onUpdate`. The active node is read
 * from the store at save time so a stale closure can never write to the wrong
 * scene.
 */
export function useSceneAutosave() {
  const { activeNode, activeStory, setActiveNode } = useStoryStore();
  const { runDiscovery } = useDiscoveryStore();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Word count is seeded from the stored value for the current node and kept
  // live by handleUpdate. Tracking the node id avoids an effect.
  const [countedNodeId, setCountedNodeId] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const wordCount = activeNode && countedNodeId === activeNode.id ? liveCount : (activeNode?.word_count ?? 0);

  function handleUpdate(ed: Editor) {
    const node = useStoryStore.getState().activeNode;
    if (!node) return;
    const content = ed.getHTML();
    setLiveCount(countWordsClean(ed.getText()));
    setCountedNodeId(node.id);
    setSaveState("unsaved");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveState("saving");
      const count = countWordsClean(ed.getText());
      const updated = await api.updateNode(node.id, { content, word_count: count });
      const current = useStoryStore.getState().activeNode;
      if (current && current.id === node.id) {
        setActiveNode({ ...current, content, word_count: updated.word_count });
      }
      setSaveState("saved");
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaveState("idle"), SAVED_FLASH_MS);
      if (activeStory?.discovery_enabled && activeStory?.discovery_auto_analyze) {
        runDiscovery(node.story_id, node.id).catch(() => {});
      }
    }, SAVE_DEBOUNCE_MS);
  }

  return { saveState, wordCount, handleUpdate };
}
