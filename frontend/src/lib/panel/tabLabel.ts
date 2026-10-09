import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { PanelTab } from "../../types/panel";
import { pageTabLabel } from "./pages";

/**
 * "This scene", or "This chapter" when a chapter's page is open: the tab follows the level.
 * Away from the prose it is named for the scene (doc 12 P2): on the Lorebook, "This scene"
 * would read as the page you are on, not the one you left.
 */
export function sceneTabLabel(): string {
  const { activeNode, activeTemplate } = useStoryStore.getState();
  if (!activeNode) return "This scene";
  if (usePanelStore.getState().side === "pages" && activeNode.title) return activeNode.title;
  const isContainer = (activeNode.children?.length ?? 0) > 0;
  const level = activeTemplate?.levels[activeNode.level]?.name;
  return isContainer && level ? `This ${level.toLowerCase()}` : "This scene";
}

/** What a tab is called in the strip and the ☰ menu. */
export function tabLabel(tab: PanelTab): string {
  return tab.kind === "page" ? pageTabLabel(tab.routeId, tab.path).label : tab.label;
}
