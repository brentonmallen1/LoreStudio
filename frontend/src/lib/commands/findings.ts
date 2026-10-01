/**
 * Findings commands (doc 12 P4): run the local checks from anywhere. Going to the page is
 * the route's own "Go to Findings". Kept apart from index.ts, which is at its size budget.
 */
import { ScanEye } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useFindingsStore } from "../../stores/findingsStore";
import { useStoryStore } from "../../stores/storyStore";

commandRegistry.register({
  id: "findings-run-local",
  label: "Check prose, tense and point of view",
  description: "The local checks: no model, a second or two",
  keywords: ["findings", "check", "prose", "tense", "pov", "passive", "adverbs", "health", "run checks"],
  icon: ScanEye,
  group: "Findings",
  when: () => !!useStoryStore.getState().activeStory,
  action: async () => {
    const story = useStoryStore.getState().activeStory;
    if (!story) return;
    await useFindingsStore.getState().runLocal();
    navigateTo(`/stories/${story.id}/findings`);
  },
});
