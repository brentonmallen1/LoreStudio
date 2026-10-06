/**
 * Numbers commands (doc 19): compare the numbers with an earlier reading, or measure them now,
 * from anywhere. Going to the page is the route's own "Go to Numbers".
 */
import { Gauge, GitCompareArrows } from "lucide-react";
import { numbersApi } from "../../api/numbers";
import { toast } from "../../stores/toastStore";
import { useStoryStore } from "../../stores/storyStore";
import { navigateTo } from "../navigation";
import { commandRegistry } from "./registry";

commandRegistry.register({
  id: "numbers-compare",
  label: "Compare the numbers with…",
  description: "The latest version, or the reading before now; change it from Compare ▾",
  keywords: ["numbers", "compare", "history", "over time", "since", "version", "trend"],
  icon: GitCompareArrows,
  group: "Numbers",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) navigateTo(`/stories/${story.id}/numbers?compare=start`);
  },
});

commandRegistry.register({
  id: "numbers-measure",
  label: "Measure the numbers now",
  description: "A reading of the book as it is, taken on the server; compare with it later",
  keywords: ["numbers", "measure", "reading", "snapshot", "history"],
  icon: Gauge,
  group: "Numbers",
  when: () => !!useStoryStore.getState().activeStory,
  action: async () => {
    const story = useStoryStore.getState().activeStory;
    if (!story) return;
    try {
      await numbersApi.measure(story.id);
      toast.success("Measured: the reading is in Numbers › Compare");
    } catch {
      toast.error("The numbers could not be measured");
    }
  },
});
