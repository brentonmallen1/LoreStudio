import { useStoryStore } from "../../stores/storyStore";
import { TOOL_LABELS, type PanelTab } from "../../types/panel";

/** "This scene", or "This chapter" when a chapter's page is open: the tab follows the level. */
export function sceneTabLabel(): string {
  const { activeNode, activeTemplate } = useStoryStore.getState();
  if (!activeNode) return "This scene";
  const isContainer = (activeNode.children?.length ?? 0) > 0;
  const level = activeTemplate?.levels[activeNode.level]?.name;
  return isContainer && level ? `This ${level.toLowerCase()}` : "This scene";
}

/** What a tab is called in the strip and the ☰ menu. */
export function tabLabel(tab: PanelTab): string {
  if (tab.kind === "scene") return sceneTabLabel();
  if (tab.kind === "tool") return TOOL_LABELS[tab.tool];
  return tab.label;
}
