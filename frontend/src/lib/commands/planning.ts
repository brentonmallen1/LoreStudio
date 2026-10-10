/**
 * Planning commands (refactor doc 10): the Notes tab (doc 15; Freewrite opens as a page), and the side
 * panel's scene tab. Kept apart from index.ts, which is at its size budget.
 */
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowRight,
  CalendarClock,
  FileText,
  ImageIcon,
  MapIcon,
  StickyNote,
} from "lucide-react";
import { goToAdjacentScene, openSceneId } from "../story/adjacentScene";
import { commandRegistry } from "./registry";
import { goBack, goForward, navigateTo } from "../navigation";
import { sceneSheetPath } from "../scene/glance";
import { useStoryStore } from "../../stores/storyStore";
import { usePanelStore } from "../../stores/panelStore";
import { useEditorBridge } from "../../stores/editorBridge";
import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";

/** Show the scene's notes in the side panel, going to the Write page first if need be. */
/** The open scene's sheet, on one of its pages (doc 24 D19): its notes or its plan. */
function showSheet(page: "notes" | "plan") {
  const { activeStory, activeNode } = useStoryStore.getState();
  if (!activeStory || !activeNode) return;
  navigateTo(`${sceneSheetPath(activeStory.id, activeNode.id)}${page === "plan" ? "" : `#${page}`}`);
}

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
  keywords: ["notes", "questions", "to-do", "scene", "sheet"],
  icon: FileText,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => showSheet("notes"),
});

commandRegistry.register({
  id: "editor-insert-image",
  label: "Insert image",
  keywords: ["image", "picture", "photo", "figure", "map", "media"],
  icon: ImageIcon,
  group: "Editor",
  when: () => !!useEditorBridge.getState().insertImage,
  action: () => useEditorBridge.getState().insertImage?.(),
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
    shortcut: formatCombo(SHORTCUTS[key].combo),
    when: () => !!useEditorBridge.getState().notes?.notes.length,
    action: () => useEditorBridge.getState().notes?.step(dir),
  });
}

// Back and Forward through where you have been (⌘[ / ⌘]), as in a browser, in the app only.
for (const [id, dir, key] of [
  ["nav-back", -1, "back"],
  ["nav-forward", 1, "forward"],
] as const) {
  commandRegistry.register({
    id,
    label: SHORTCUTS[key].label,
    keywords: ["back", "forward", "history", "previous page", "where I was", "return"],
    icon: dir === 1 ? ArrowRight : ArrowLeft,
    group: "Navigation",
    shortcut: formatCombo(SHORTCUTS[key].combo),
    action: dir === 1 ? goForward : goBack,
  });
}

for (const [id, dir, key] of [
  ["scene-next", 1, "nextScene"],
  ["scene-previous", -1, "prevScene"],
] as const) {
  commandRegistry.register({
    id,
    label: SHORTCUTS[key].label,
    keywords: ["scene", "chapter", "go", dir === 1 ? "next" : "previous", dir === 1 ? "forward" : "back"],
    icon: dir === 1 ? ArrowDown : ArrowUp,
    group: "Navigation",
    shortcut: formatCombo(SHORTCUTS[key].combo),
    when: () => !!openSceneId(),
    action: () => void goToAdjacentScene(dir),
  });
}

commandRegistry.register({
  id: "editor-show-story-plan",
  label: "Show story plan",
  description: "The scene's plan, with the logline and what the people in it want folded under it",
  keywords: ["plan", "logline", "goal", "conflict", "who is here", "outline", "panel"],
  icon: MapIcon,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => showSheet("plan"),
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
