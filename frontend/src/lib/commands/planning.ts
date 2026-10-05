/**
 * Planning commands (refactor doc 10): Freewrite and the Notes tab (doc 15), and the side
 * panel's scene tab. Kept apart from index.ts, which is at its size budget.
 */
import { CalendarClock, FileText, MapIcon, NotebookPen, StickyNote } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useStoryStore } from "../../stores/storyStore";
import { usePanelStore } from "../../stores/panelStore";
import { useEditorBridge } from "../../stores/editorBridge";
import { SHORTCUTS } from "../keyboard/shortcuts";

/** Show the scene's notes in the side panel, going to the Write page first if need be. */
function showSceneTab() {
  const { activeStory } = useStoryStore.getState();
  if (!activeStory) return;
  usePanelStore.getState().activate("scene");
  if (!window.location.pathname.endsWith("/write")) navigateTo(`/stories/${activeStory.id}/write`);
}

commandRegistry.register({
  id: "panel-freewrite",
  label: "Freewrite beside the page",
  keywords: ["idea", "brain dump", "note", "thought", "loose", "capture", "stream of consciousness"],
  icon: NotebookPen,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => usePanelStore.getState().openTool("freewrite"),
});

commandRegistry.register({
  id: "panel-notes",
  label: "Notes beside the page",
  keywords: ["notes", "question", "undecided", "to-do", "todo", "ideas", "plan"],
  icon: StickyNote,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => usePanelStore.getState().openTool("notes"),
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

for (const [id, dir, key] of [
  ["editor-next-note", 1, "nextNote"],
  ["editor-prev-note", -1, "prevNote"],
] as const) {
  commandRegistry.register({
    id,
    label: SHORTCUTS[key].label,
    keywords: ["note", "margin", "question", "to-do", dir === 1 ? "next" : "previous"],
    icon: StickyNote,
    group: "Editor",
    shortcut: SHORTCUTS[key].combo,
    when: () => !!useEditorBridge.getState().notes?.notes.length,
    action: () => useEditorBridge.getState().notes?.step(dir),
  });
}

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

commandRegistry.register({
  id: "plan-timeline",
  label: "Timeline: scenes in the order they happen",
  description: "Each scene's date and era, against the order the reader meets them",
  keywords: ["timeline", "chronology", "chronological", "flashback", "date", "era", "when", "order"],
  icon: CalendarClock,
  group: "Navigation",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) navigateTo(`/stories/${story.id}/plan?view=timeline`);
  },
});
