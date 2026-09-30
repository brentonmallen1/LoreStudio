import { TOOL_LABELS, type PanelTab } from "../../types/panel";

/** What a tab is called in the strip and the ☰ menu. */
export function tabLabel(tab: PanelTab): string {
  if (tab.kind === "scene") return "This scene";
  if (tab.kind === "tool") return TOOL_LABELS[tab.tool];
  return tab.label;
}
