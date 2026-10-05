/**
 * Series commands (series doc). The Series page is not a story page, so lib/routes.ts does
 * not generate its command: these are its way in from the palette, and coverage.test.ts
 * holds them in place.
 */
import { BookCopy, BookPlus } from "lucide-react";
import { commandRegistry } from "./registry";
import { navigateTo } from "../navigation";
import { seriesPath } from "../series/sections";
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
  id: "series-new",
  label: "New series",
  description: "Plan a series before any book of it: its books, their parts and what changes between them",
  keywords: ["series", "new series", "trilogy", "saga", "plan", "books", "epic"],
  icon: BookCopy,
  group: "Create",
  action: () => navigateTo("/?newSeries=1"),
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

// The series page's sections (v1.5): each a way in from any book of the series.
for (const [id, section, label, description, keywords] of [
  [
    "series-plan",
    "plan",
    "The series' Plan",
    "The books, what each one does, the arc across them and what changes from book to book",
    ["plan", "series", "arc", "books", "parts", "axes", "viewpoint", "era", "outline"],
  ],
  [
    "series-canon",
    "canon",
    "The series' Canon",
    "Every character, place and part of the world the books share, and how each changes",
    ["canon", "series", "shared", "progression", "enduring", "evolving"],
  ],
  [
    "series-promises",
    "promises",
    "Promises across the books",
    "Every thread and twist the series shares, a column per book",
    ["promises", "threads", "twists", "series", "tapestry", "across books"],
  ],
  [
    "series-research",
    "research",
    "The series' shared research",
    "Research, images and diagrams every book of the series has, kept in step",
    ["research", "compendium", "shared", "series", "images", "diagrams"],
  ],
  [
    "series-story-so-far",
    "story-so-far",
    "The story so far",
    "What each book of the series leaves the reader with",
    ["story so far", "recap", "previously", "reader knows", "series", "reminder"],
  ],
] as const) {
  commandRegistry.register({
    id,
    label,
    description,
    keywords: [...keywords],
    icon: BookCopy,
    group: "Navigation",
    when: () => !!inSeries(),
    action: () => {
      const series = inSeries();
      if (series) navigateTo(seriesPath(series.id, section));
    },
  });
}
