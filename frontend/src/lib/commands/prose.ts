/**
 * How the prose shows its dialogue (2026-10-16), from the palette as well as Settings › Writing
 * and the editor's ⋯. Kept apart from index.ts, which is at its size budget.
 */
import { Highlighter } from "lucide-react";
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
