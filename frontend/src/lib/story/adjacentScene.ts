import type { StoryStructureTemplate, StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import { navigateTo } from "../navigation";
import { sceneLeaves } from "../planning/methods";

/**
 * The scene before or after `activeId` in reading order (⌘[ and ⌘]): the scenes the strip
 * shows, in its order. From a chapter's own page, the next scene is its first and the one
 * before is the last scene ahead of it. Null at either end.
 */
export function adjacentScene(
  structure: StructureNode[],
  template: Pick<StoryStructureTemplate, "levels" | "flat"> | null,
  activeId: string,
  dir: 1 | -1,
): StructureNode | null {
  const order: string[] = [];
  const walk = (list: StructureNode[]) => {
    for (const n of [...list].sort((a, b) => a.position - b.position)) {
      order.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(structure);
  const at = order.indexOf(activeId);
  if (at < 0) return null;
  const scenes = sceneLeaves(structure, template).map((n) => ({ n, i: order.indexOf(n.id) }));
  const found = dir === 1 ? scenes.find((s) => s.i > at) : [...scenes].reverse().find((s) => s.i < at);
  return found?.n ?? null;
}

/** The scene open on the Write page, or null anywhere else. */
export function openSceneId(pathname = window.location.pathname): string | null {
  return /\/stories\/[^/]+\/write\/([^/?#]+)/.exec(pathname)?.[1] ?? null;
}

/** Open the scene before or after the one on the page. False when there is none to go to. */
export function goToAdjacentScene(dir: 1 | -1): boolean {
  const { activeStory, structure, activeTemplate } = useStoryStore.getState();
  const at = openSceneId();
  const next = activeStory && at ? adjacentScene(structure, activeTemplate, at, dir) : null;
  if (!activeStory || !next) return false;
  navigateTo(`/stories/${activeStory.id}/write/${next.id}`);
  return true;
}
