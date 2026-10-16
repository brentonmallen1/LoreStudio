/**
 * The discovery loop's commands (doc 29 D6): What you've written on the Overview, and organizing
 * the prose: split the open scene at the cursor, join it with the next one, and wrap scenes in a
 * chapter from the Outline. Kept apart from index.ts, which is at its size budget.
 */
import { FolderPlus, Merge, Scissors, ScrollText } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useEditorBridge } from "../../stores/editorBridge";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import { CHOOSE_HINT } from "../outline/selection";

commandRegistry.register({
  id: "written-open",
  label: "What you've written",
  description: "Your scenes in a line each, who and where your prose names, and offers to tidy up",
  keywords: ["what have i written", "written", "so far", "discovery", "summary", "tidy", "names", "organize"],
  icon: ScrollText,
  group: "Navigation",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) navigateTo(`/stories/${story.id}#written`);
  },
});

commandRegistry.register({
  id: "organize-split",
  label: "Split the scene here",
  description: "The words after the cursor become the next scene, in the same chapter",
  keywords: ["split", "cut", "divide", "break", "new scene", "scene", "two scenes"],
  icon: Scissors,
  group: "Editor",
  when: () => !!useEditorBridge.getState().organize,
  action: () => useEditorBridge.getState().organize?.split(),
});

commandRegistry.register({
  id: "organize-merge",
  label: "Join with the next scene",
  description: "The next scene's words follow this one's, after a scene break",
  keywords: ["join", "merge", "combine", "next scene", "one scene"],
  icon: Merge,
  group: "Editor",
  when: () => !!useEditorBridge.getState().organize,
  action: () => useEditorBridge.getState().organize?.merge(),
});

commandRegistry.register({
  id: "organize-wrap",
  label: "Wrap scenes in a chapter",
  description: "Choose scenes in the Outline and put them in a chapter of their own",
  keywords: ["wrap", "chapter", "make chapters", "group", "chapters", "organize", "tidy"],
  icon: FolderPlus,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (!story) return;
    navigateTo(`/stories/${story.id}/outline?view=list`);
    toast.info(CHOOSE_HINT);
  },
});
