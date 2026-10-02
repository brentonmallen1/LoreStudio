/**
 * Side panel commands (refactor doc 11): open a tool as a tab, show or hide the panel,
 * close the tab you are on. Kept apart from index.ts, which is at its size budget.
 */
import { GitBranch, MapPin, PanelRight, Users, X } from "lucide-react";
import { commandRegistry } from "./registry";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { ToolId } from "../../types/panel";
import { SHORTCUTS } from "../keyboard/shortcuts";

const inStory = () => !!useStoryStore.getState().activeStory;

const TOOLS: { tool: ToolId; label: string; keywords: string[]; icon: typeof Users }[] = [
  {
    tool: "characters",
    label: "Characters beside the page",
    keywords: ["cast", "people", "panel"],
    icon: Users,
  },
  {
    tool: "places",
    label: "Places beside the page",
    keywords: ["locations", "settings", "panel"],
    icon: MapPin,
  },
  {
    tool: "threads",
    label: "Threads beside the page",
    keywords: ["plot", "mice", "subplot", "panel"],
    icon: GitBranch,
  },
];

for (const t of TOOLS) {
  commandRegistry.register({
    id: `panel-open-${t.tool}`,
    label: t.label,
    keywords: t.keywords,
    icon: t.icon,
    group: "Manuscript",
    when: inStory,
    action: () => usePanelStore.getState().openTool(t.tool),
  });
}

commandRegistry.register({
  id: "panel-toggle",
  label: "Show or hide the side panel",
  keywords: ["panel", "notes", "sidebar", "tabs", "hide", "show"],
  icon: PanelRight,
  group: "View",
  shortcut: SHORTCUTS.togglePanel.combo,
  when: inStory,
  action: () => usePanelStore.getState().toggle(),
});

commandRegistry.register({
  id: "panel-close-tab",
  label: "Close this tab",
  keywords: ["panel", "tab", "close"],
  icon: X,
  group: "View",
  when: () => inStory() && usePanelStore.getState().activeTabId !== "scene",
  action: () => {
    const { activeTabId, close } = usePanelStore.getState();
    close(activeTabId);
  },
});
