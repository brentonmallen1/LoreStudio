/**
 * Outline commands (doc 29 D2, D3): the Storyboard is the Outline's Cards now, so its old words
 * ("storyboard", "corkboard", "index cards") open them. Kept apart from index.ts, which is at
 * its size budget.
 */
import { LayoutGrid, Lightbulb } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useStoryStore } from "../../stores/storyStore";

commandRegistry.register({
  id: "outline-cards",
  label: "See the Outline as cards",
  description: "A column per chapter, a card per scene",
  keywords: ["storyboard", "corkboard", "index cards", "cards", "board", "scene cards"],
  icon: LayoutGrid,
  group: "Navigation",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) navigateTo(`/stories/${story.id}/outline?view=cards`);
  },
});

// The beat boards are the Outline's Not placed yet tray now (doc 29 D3): their words open it.
commandRegistry.register({
  id: "outline-tray",
  label: "Ideas not placed yet",
  description: "The Outline's tray: things that should happen, not tied to a scene yet",
  keywords: ["beat board", "beat boards", "beats", "tray", "not placed yet", "ideas", "loose ideas", "jot"],
  icon: Lightbulb,
  group: "Navigation",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) navigateTo(`/stories/${story.id}/outline`);
  },
});
