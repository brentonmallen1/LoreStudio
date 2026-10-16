/**
 * The discovery loop's commands (doc 29 D6): What you've written on the Overview, and organizing
 * the prose: split the open scene at the cursor, join it with the next one, and wrap scenes in a
 * chapter from the Outline; and a scene's takes (doc 29 D7): try another version, compare them, and
 * use the open one. Kept apart from index.ts, which is at its size budget.
 */
import { CheckCircle2, Columns2, CopyPlus, FolderPlus, Merge, Scissors, ScrollText } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useEditorBridge } from "../../stores/editorBridge";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import { openTake, useTakesStore } from "../../stores/takesStore";
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

commandRegistry.register({
  id: "takes-try",
  label: "Try another version",
  description: "A copy of this scene to change as you like, as a new take; the one that counts stays",
  keywords: [
    "take",
    "takes",
    "version",
    "alternate",
    "variant",
    "rewrite",
    "draft",
    "another version",
    "copy",
  ],
  icon: CopyPlus,
  group: "Editor",
  when: () => !!useEditorBridge.getState().takes,
  action: () => useEditorBridge.getState().takes?.tryAnother(),
});

commandRegistry.register({
  id: "takes-compare",
  label: "Compare takes",
  description: "Two takes of this scene side by side, the words that differ marked",
  keywords: ["compare", "takes", "versions", "diff", "difference", "side by side"],
  icon: Columns2,
  group: "Editor",
  when: () => !!useEditorBridge.getState().takes && useTakesStore.getState().takes.length > 1,
  action: () => useEditorBridge.getState().takes?.compare(true),
});

commandRegistry.register({
  id: "takes-use",
  label: "Use this take",
  description: "Make the open take the one that counts: the scene in your manuscript, exports and checks",
  keywords: ["use", "take", "choose", "counts", "keep", "pick version"],
  icon: CheckCircle2,
  group: "Editor",
  when: () => {
    const take = openTake(useStoryStore.getState().activeNode?.id);
    return !!useEditorBridge.getState().takes && !!take && !take.counts;
  },
  action: () => {
    const take = openTake(useStoryStore.getState().activeNode?.id);
    if (take) useEditorBridge.getState().takes?.use(take.id);
  },
});
