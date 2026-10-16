/**
 * The discovery loop's commands (doc 29 D6): What you've written, on the Overview. Kept apart
 * from index.ts, which is at its size budget.
 */
import { ScrollText } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useStoryStore } from "../../stores/storyStore";

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
