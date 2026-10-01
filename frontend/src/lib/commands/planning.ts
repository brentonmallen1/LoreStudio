/**
 * Planning commands (refactor doc 10): the Ideas tab, open questions, and the side
 * panel's scene tab. Kept apart from index.ts, which is at its size budget.
 */
import { CircleHelp, FileText, Lightbulb, MapIcon } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useStoryStore } from "../../stores/storyStore";
import { usePanelStore } from "../../stores/panelStore";

/** Show the scene's notes in the side panel, going to the Write page first if need be. */
function showSceneTab() {
  const { activeStory } = useStoryStore.getState();
  if (!activeStory) return;
  usePanelStore.getState().activate("scene");
  if (!window.location.pathname.endsWith("/write")) navigateTo(`/stories/${activeStory.id}/write`);
}

commandRegistry.register({
  id: "plan-capture-idea",
  label: "Capture an idea",
  keywords: ["idea", "brain dump", "note", "thought", "sort", "plan"],
  icon: Lightbulb,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => usePanelStore.getState().openTool("ideas"),
});

commandRegistry.register({
  id: "plan-open-questions",
  label: "Open questions",
  keywords: ["question", "undecided", "unknown", "decide", "plan"],
  icon: CircleHelp,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => usePanelStore.getState().openTool("questions"),
});

commandRegistry.register({
  id: "editor-show-scene-notes",
  label: "Show scene notes",
  keywords: ["notes", "synopsis", "purpose", "entry", "exit", "panel"],
  icon: FileText,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: showSceneTab,
});

commandRegistry.register({
  id: "editor-show-story-plan",
  label: "Show story plan",
  description: "The logline, who is here and what they want, under the scene's notes",
  keywords: ["plan", "logline", "goal", "conflict", "who is here", "outline", "panel"],
  icon: MapIcon,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: showSceneTab,
});
