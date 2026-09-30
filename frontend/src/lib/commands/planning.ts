/**
 * Planning commands (refactor doc 10): the Ideas tab, open questions, and the editor's side
 * panel tabs. Kept apart from index.ts, which is at its size budget.
 */
import { CircleHelp, FileText, Lightbulb, MapIcon } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";

/** Open the editor's side panel on a tab, going to the Write page first if need be. */
function showScenePanel(panel: "scene" | "story") {
  const { activeStory } = useStoryStore.getState();
  if (!activeStory) return;
  useUIStore.getState().setScenePanel(panel);
  if (!window.location.pathname.endsWith("/write")) navigateTo(`/stories/${activeStory.id}/write`);
}

commandRegistry.register({
  id: "plan-capture-idea",
  label: "Capture an Idea",
  keywords: ["idea", "brain dump", "note", "thought", "sort", "plan"],
  icon: Lightbulb,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const { activeStory } = useStoryStore.getState();
    if (activeStory) navigateTo(`/stories/${activeStory.id}/plan?view=ideas`);
  },
});

commandRegistry.register({
  id: "plan-open-questions",
  label: "Open Questions",
  keywords: ["question", "undecided", "unknown", "decide", "plan"],
  icon: CircleHelp,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const { activeStory } = useStoryStore.getState();
    if (activeStory) navigateTo(`/stories/${activeStory.id}/plan?view=ideas`);
  },
});

commandRegistry.register({
  id: "editor-show-scene-notes",
  label: "Show Scene Notes",
  keywords: ["notes", "synopsis", "purpose", "entry", "exit", "panel"],
  icon: FileText,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => showScenePanel("scene"),
});

commandRegistry.register({
  id: "editor-show-story-plan",
  label: "Show Story Plan",
  keywords: ["plan", "logline", "goal", "conflict", "who is here", "outline", "panel"],
  icon: MapIcon,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => showScenePanel("story"),
});
