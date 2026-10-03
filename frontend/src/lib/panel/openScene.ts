import { findNode } from "../../components/layout/structureTreeMeta";
import { navigateTo } from "../navigation";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";

/** Open a scene from anywhere in the panel: select it in the tree and go to the page. */
export function openScene(nodeId: string): void {
  const { structure, activeStory, setActiveNode } = useStoryStore.getState();
  const node = findNode(structure, nodeId);
  if (!node || !activeStory) return;
  setActiveNode(node);
  navigateTo(`/stories/${activeStory.id}/write/${nodeId}`);
}

/**
 * A click on a scene in the strip: open it to write, or with ⌥ (Alt) held, pin it on top
 * of the This scene tab to read beside the scene you are in.
 */
export function stopClick(e: { altKey: boolean }, nodeId: string, open: (id: string) => void): void {
  if (e.altKey) usePanelStore.getState().pinScene(nodeId);
  else open(nodeId);
}

/** The title of a scene by id, for lists that only hold ids. */
export function sceneTitle(nodeId: string): string {
  return findNode(useStoryStore.getState().structure, nodeId)?.title ?? "a scene";
}
