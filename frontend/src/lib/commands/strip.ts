/**
 * Story strip commands (refactor doc 11, phase 3): collapse or expand the book down the left
 * edge, and choose what colours its stops. Kept apart from index.ts, which is at its
 * size budget.
 */
import { PanelLeft, Palette } from "lucide-react";
import { commandRegistry } from "./registry";
import { COLOUR_MODES, toggleStrip } from "../strip/stripModel";
import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";

const inStory = () => !!useStoryStore.getState().activeStory;

commandRegistry.register({
  id: "strip-cycle-width",
  label: "Collapse or expand the story strip",
  keywords: ["tree", "outline", "chapters", "scenes", "strip", "sidebar", "structure", "widen", "narrow"],
  icon: PanelLeft,
  group: "View",
  shortcut: formatCombo(SHORTCUTS.cycleStrip.combo),
  when: inStory,
  action: () => {
    const { stripWidth, setStripWidth } = useUIStore.getState();
    setStripWidth(toggleStrip(stripWidth));
  },
});

for (const mode of COLOUR_MODES) {
  commandRegistry.register({
    id: `strip-colour-${mode.id}`,
    label: `Colour the strip by ${mode.short}`,
    description: mode.label,
    keywords: ["strip", "colour", "color", "tree", mode.id, mode.short.toLowerCase()],
    icon: Palette,
    group: "View",
    when: inStory,
    action: () => useUIStore.getState().setStripColourMode(mode.id),
  });
}
