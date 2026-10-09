/**
 * Interface size commands (doc 17). Kept apart from index.ts, which is at its size budget.
 * No shortcut: ⌘= and ⌘- are the browser's own zoom, which scales the prose as well.
 */
import { AArrowDown, AArrowUp, Layers, Monitor, PenLine, Settings, SunMoon } from "lucide-react";
import { commandRegistry } from "./registry";
import { UI_SCALES, stepScale } from "../appearance/uiScale";
import { getMode, setMode } from "../mode";
import { navigateTo } from "../navigation";
import { toast } from "../../stores/toastStore";
import { THEME_META, useUIStore, type ColorMode } from "../../stores/uiStore";

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

// ── Doc 24 (quiet chrome): what left the header is in the palette too ─────────

commandRegistry.register({
  id: "appearance-system",
  label: "Color mode: System",
  description: "Light or dark as the computer is set",
  keywords: ["system", "auto", "automatic", "os", "mode", "theme", "color", "colour", "appearance"],
  icon: Monitor,
  group: "Appearance",
  action: () => useUIStore.getState().setColorMode("system"),
});

/** Light, dark, system, round again; a dark-only theme skips light. */
export function nextColorMode(mode: ColorMode, darkOnly: boolean): ColorMode {
  const next: Record<ColorMode, ColorMode> = { light: "dark", dark: "system", system: "light" };
  const step = next[mode];
  return step === "light" && darkOnly ? "dark" : step;
}

commandRegistry.register({
  id: "appearance-cycle",
  label: "Cycle color mode",
  description: "Light, dark, then the system's",
  keywords: ["toggle", "switch", "dark mode", "light mode", "color", "colour", "appearance", "theme"],
  icon: SunMoon,
  group: "Appearance",
  action: () => {
    const { colorMode, themeName, setColorMode } = useUIStore.getState();
    setColorMode(nextColorMode(colorMode, THEME_META[themeName].darkOnly));
  },
});

// The mode used to be a pill in the header; Writer mode hides the AI group, so these sit in
// View, where both modes see them.
async function switchMode(mode: "writer" | "studio") {
  try {
    await setMode(mode);
  } catch {
    toast.error("The mode did not change. Try again in a moment.");
  }
}

commandRegistry.register({
  id: "mode-writer",
  label: "Switch to Writer mode",
  description: "The writing tools alone, no AI anywhere",
  keywords: ["writer", "mode", "no ai", "hide ai", "simple", "interface"],
  icon: PenLine,
  group: "View",
  when: () => getMode() === "studio",
  action: () => switchMode("writer"),
});

commandRegistry.register({
  id: "mode-studio",
  label: "Switch to Studio mode",
  description: "Everything, the Assistant included",
  keywords: ["studio", "mode", "ai", "assistant", "show ai", "interface"],
  icon: Layers,
  group: "View",
  when: () => getMode() === "writer",
  action: () => switchMode("studio"),
});

commandRegistry.register({
  id: "open-settings",
  label: "Open settings",
  keywords: ["settings", "preferences", "options", "configure", "gear"],
  icon: Settings,
  group: "Settings",
  action: () => navigateTo("/settings"),
});
