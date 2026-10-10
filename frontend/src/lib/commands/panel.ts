/**
 * Side panel commands (refactor doc 11): show a tool beside the page, open a page beside the
 * prose (doc 24 D2), show or hide the panel, close the tab you are on. Kept apart from
 * index.ts, which is at its size budget.
 */
import { GitBranch, MapPin, MessageSquare, PanelRight, Users, X } from "lucide-react";
import { commandRegistry } from "./registry";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { launcherOf, type ToolId } from "../../types/panel";
import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import { STORY_ROUTES } from "../routes";
import { getAIAvailable, getMode } from "../mode";
import { canOpenBeside } from "../panel/pages";
import { openBesideTheProse } from "../panel/openBeside";

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
  {
    // The open scene's lines as a thread (doc 24 D8); it was "Dialogue only" in the scene's ⋯.
    tool: "dialogue",
    label: "Show the dialogue",
    keywords: ["dialogue", "dialog", "speakers", "conversation", "quotes", "dialogue only", "panel"],
    icon: MessageSquare,
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
  shortcut: formatCombo(SHORTCUTS.togglePanel.combo),
  when: inStory,
  action: () => usePanelStore.getState().toggle(),
});

commandRegistry.register({
  id: "panel-close-tab",
  label: "Close this tab",
  keywords: ["panel", "tab", "close"],
  icon: X,
  group: "View",
  when: () => {
    // A tab, or the Assistant; This scene and the tools are not tabs to close.
    const { showing, open } = usePanelStore.getState();
    const launcher = launcherOf(showing);
    return inStory() && open && (!launcher || launcher === "assistant");
  },
  action: () => {
    const { showing, close } = usePanelStore.getState();
    close(showing);
  },
});

// Any page beside the prose (doc 24 D2): one command each, in the View group so the
// Navigation results for a page's name still lead with going there.
for (const route of STORY_ROUTES.filter(canOpenBeside)) {
  commandRegistry.register({
    id: `panel-beside-${route.id}`,
    label: `Open ${route.label} beside the prose`,
    keywords: [
      "beside",
      "side panel",
      "next to",
      "split",
      route.label.toLowerCase(),
      ...(route.keywords ?? []),
    ],
    icon: route.icon,
    group: "View",
    when: () => inStory() && route.modes.includes(getMode()) && (!route.ai || getAIAvailable()),
    action: () => openBesideTheProse(route.id),
  });
}
