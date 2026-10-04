/**
 * Series commands (series doc). The Series page is not a story page, so lib/routes.ts does
 * not generate its command: these are its way in from the palette, and coverage.test.ts
 * holds them in place.
 */
import { BookCopy, BookPlus } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { useSeriesStore } from "../../stores/seriesStore";
import { useStoryStore } from "../../stores/storyStore";

const inSeries = () => {
  const story = useStoryStore.getState().activeStory;
  const { storyId, series } = useSeriesStore.getState();
  return story && storyId === story.id ? series : null;
};

commandRegistry.register({
  id: "series-open",
  label: "Open the series",
  description: "This book's series: its books, and the Canon they share",
  keywords: ["series", "canon", "books", "trilogy", "shared", "sequel"],
  icon: BookCopy,
  group: "Navigation",
  when: () => !!inSeries(),
  action: () => {
    const series = inSeries();
    if (series) navigateTo(`/series/${series.id}`);
  },
});

commandRegistry.register({
  id: "series-new-book",
  label: "New book in this series",
  keywords: ["series", "sequel", "next book", "new book", "carry over"],
  icon: BookPlus,
  group: "Create",
  when: () => !!inSeries(),
  action: () => {
    const series = inSeries();
    if (series) navigateTo(`/series/${series.id}?new=1`);
  },
});

commandRegistry.register({
  id: "series-write-sequel",
  label: "Write a sequel to this book",
  description: "A new book after this one, starting with whoever you carry over",
  keywords: ["sequel", "series", "next book", "follow up", "carry over"],
  icon: BookPlus,
  group: "Create",
  when: () => !!useStoryStore.getState().activeStory && !inSeries(),
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) navigateTo(`/?sequel=${story.id}`);
  },
});
