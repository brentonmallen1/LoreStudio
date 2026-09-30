import { findNode } from "../../components/layout/structureTreeMeta";
import { navigateTo } from "../navigation";
import { useStoryStore } from "../../stores/storyStore";

/** Open a scene from anywhere in the panel: select it in the tree and go to the page. */
export function openScene(nodeId: string): void {
  const { structure, activeStory, setActiveNode } = useStoryStore.getState();
  const node = findNode(structure, nodeId);
  if (!node || !activeStory) return;
  setActiveNode(node);
  if (!window.location.pathname.endsWith("/write")) navigateTo(`/stories/${activeStory.id}/write`);
}

/** The title of a scene by id, for lists that only hold ids. */
export function sceneTitle(nodeId: string): string {
  return findNode(useStoryStore.getState().structure, nodeId)?.title ?? "a scene";
}
