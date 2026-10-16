/**
 * How the prose shows its dialogue (2026-10-16), from the palette as well as Settings › Writing
 * and the editor's ⋯. Kept apart from index.ts, which is at its size budget.
 */
import { EyeOff, Highlighter, Tag } from "lucide-react";
import { commandRegistry } from "./registry";
import { useProseViewStore } from "../../stores/proseViewStore";

const KEYWORDS = ["dialogue", "dialog", "speaker", "quote", "color", "colour", "character", "highlight"];

commandRegistry.register({
  id: "prose-speaker-colors-on",
  label: "Color dialogue by speaker",
  description: "Each line on a soft tint of its speaker's color, in the prose",
  keywords: KEYWORDS,
  icon: Highlighter,
  group: "View",
  when: () => !useProseViewStore.getState().speakerColors,
  action: () => useProseViewStore.getState().setSpeakerColors(true),
});

commandRegistry.register({
  id: "prose-speaker-colors-off",
  label: "Stop coloring dialogue by speaker",
  description: "Dialogue back to plain prose",
  keywords: KEYWORDS,
  icon: Highlighter,
  group: "View",
  when: () => useProseViewStore.getState().speakerColors,
  action: () => useProseViewStore.getState().setSpeakerColors(false),
});

const TAG_WORDS = [
  "speaker",
  "tag",
  "tags",
  "name",
  "hide",
  "show",
  "dialogue",
  "quote",
  "clean",
  "distraction",
];

commandRegistry.register({
  id: "prose-hide-speaker-tags",
  label: "Hide speaker tags",
  description: "A line's <Name> shows only while the cursor is in that line",
  keywords: TAG_WORDS,
  icon: EyeOff,
  group: "View",
  when: () => !useProseViewStore.getState().hideSpeakerTags,
  action: () => useProseViewStore.getState().setHideSpeakerTags(true),
});

commandRegistry.register({
  id: "prose-show-speaker-tags",
  label: "Show speaker tags",
  description: "Every line's <Name> in sight again",
  keywords: TAG_WORDS,
  icon: Tag,
  group: "View",
  when: () => useProseViewStore.getState().hideSpeakerTags,
  action: () => useProseViewStore.getState().setHideSpeakerTags(false),
});
