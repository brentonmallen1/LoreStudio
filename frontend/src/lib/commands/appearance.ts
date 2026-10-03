/**
 * Interface size commands (doc 17). Kept apart from index.ts, which is at its size budget.
 * No shortcut: ⌘= and ⌘- are the browser's own zoom, which scales the prose as well.
 */
import { AArrowDown, AArrowUp } from "lucide-react";
import { commandRegistry } from "./registry";
import { UI_SCALES, stepScale } from "../appearance/uiScale";
import { useUIStore } from "../../stores/uiStore";

function step(dir: 1 | -1) {
  const { uiScale, setUiScale } = useUIStore.getState();
  setUiScale(stepScale(uiScale, dir));
}

commandRegistry.register({
  id: "view-ui-size-up",
  label: "Larger interface",
  description: "Menus, buttons and labels one size up; the writing keeps its size",
  keywords: ["interface", "ui", "size", "bigger", "zoom", "text", "readability", "appearance"],
  icon: AArrowUp,
  group: "Appearance",
  when: () => useUIStore.getState().uiScale !== UI_SCALES[UI_SCALES.length - 1].value,
  action: () => step(1),
});

commandRegistry.register({
  id: "view-ui-size-down",
  label: "Smaller interface",
  description: "Menus, buttons and labels one size down; the writing keeps its size",
  keywords: ["interface", "ui", "size", "smaller", "zoom", "text", "appearance"],
  icon: AArrowDown,
  group: "Appearance",
  when: () => useUIStore.getState().uiScale !== UI_SCALES[0].value,
  action: () => step(-1),
});
