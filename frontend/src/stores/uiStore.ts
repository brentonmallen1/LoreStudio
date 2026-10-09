import {
  COLOUR_MODES,
  EXPANDED_DEFAULT_PX,
  clampStripPx,
  type ColourMode,
  type StripWidth,
} from "../lib/strip/stripModel";
import { create } from "zustand";
import { ROOT_PX, isUiScale, scaleFactor, type UiScale } from "../lib/appearance/uiScale";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../lib/preferences/accountPrefs";

export type ThemeName = "zen" | "e-ink" | "nord" | "solarized" | "dracula" | "gruvbox" | "catppuccin";
export type ColorMode = "light" | "dark" | "system";
export type EditorFontFamily =
  | "merriweather"
  | "noto-serif"
  | "literata"
  | "bitter"
  | "inter"
  | "atkinson-hyperlegible"
  | "jetbrains-mono"
  | "roboto-mono"
  | "space-mono"
  | "courier-prime"
  | "cutive"
  | "special-elite";
export type EditorFontSize = "small" | "medium" | "large" | "xl";
export type EditorLineWidth = "narrow" | "medium" | "wide" | "full";

export type FontCategory = "serif" | "sans" | "mono" | "typewriter";

export interface FontOption {
  value: EditorFontFamily;
  label: string;
  category: FontCategory;
  stack: string;
}

export const FONT_OPTIONS: FontOption[] = [
  // Serif
  {
    value: "merriweather",
    label: "Merriweather",
    category: "serif",
    stack: '"Merriweather", Georgia, serif',
  },
  { value: "noto-serif", label: "Noto Serif", category: "serif", stack: '"Noto Serif", Georgia, serif' },
  { value: "literata", label: "Literata", category: "serif", stack: '"Literata", Georgia, serif' },
  { value: "bitter", label: "Bitter", category: "serif", stack: '"Bitter", Georgia, serif' },
  // Sans
  { value: "inter", label: "Inter", category: "sans", stack: '"Inter", system-ui, sans-serif' },
  {
    value: "atkinson-hyperlegible",
    label: "Atkinson Hyperlegible",
    category: "sans",
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  // Mono
  {
    value: "jetbrains-mono",
    label: "JetBrains Mono",
    category: "mono",
    stack: '"JetBrains Mono", monospace',
  },
  { value: "roboto-mono", label: "Roboto Mono", category: "mono", stack: '"Roboto Mono", monospace' },
  { value: "space-mono", label: "Space Mono", category: "mono", stack: '"Space Mono", monospace' },
  // Typewriter
  {
    value: "courier-prime",
    label: "Courier Prime",
    category: "typewriter",
    stack: '"Courier Prime", "Courier New", monospace',
  },
  { value: "cutive", label: "Cutive", category: "typewriter", stack: '"Cutive", "Courier New", monospace' },
  {
    value: "special-elite",
    label: "Special Elite",
    category: "typewriter",
    stack: '"Special Elite", "Courier New", monospace',
  },
];

export const FONT_CATEGORIES: { value: FontCategory; label: string }[] = [
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Monospace" },
  { value: "typewriter", label: "Typewriter" },
];

export function getFontStack(fontFamily: EditorFontFamily): string {
  return FONT_OPTIONS.find((f) => f.value === fontFamily)?.stack ?? FONT_OPTIONS[0].stack;
}

// Characters of the prose font, not px (doc 17): a larger writing size keeps its words per
// line. Medium is today's 640px column in Merriweather at 15px.
// Full is a share of the space the page has, not of the font: three quarters of it.
export const LINE_WIDTHS: Record<EditorLineWidth, string> = {
  narrow: "48ch",
  medium: "60ch",
  wide: "76ch",
  full: "75%",
};

/** The widths as every picker offers them (Settings, the editor's menu, the header). */
export const LINE_WIDTH_OPTIONS: { value: EditorLineWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

// In px, not rem: the interface size scales the root, and the prose must not follow it (doc 17 D2).
export const FONT_SIZES: Record<EditorFontSize, string> = {
  small: `${ROOT_PX * 0.875}px`,
  medium: `${ROOT_PX}px`,
  large: `${ROOT_PX * 1.125}px`,
  xl: `${ROOT_PX * 1.25}px`,
};

export const THEME_META: Record<ThemeName, { label: string; darkOnly: boolean }> = {
  zen: { label: "Zen", darkOnly: false },
  "e-ink": { label: "E-ink", darkOnly: false },
  nord: { label: "Nord", darkOnly: false },
  solarized: { label: "Solarized", darkOnly: false },
  dracula: { label: "Dracula", darkOnly: true },
  gruvbox: { label: "Gruvbox", darkOnly: false },
  catppuccin: { label: "Catppuccin", darkOnly: false },
};

const ALL_THEME_NAMES = Object.keys(THEME_META) as ThemeName[];

interface UIState {
  themeName: ThemeName;
  colorMode: ColorMode;
  setThemeName: (theme: ThemeName) => void;
  setColorMode: (mode: ColorMode) => void;

  // Editor typography
  editorFontFamily: EditorFontFamily;
  editorFontSize: EditorFontSize;
  editorLineWidth: EditorLineWidth;
  setEditorFontFamily: (font: EditorFontFamily) => void;
  setEditorFontSize: (size: EditorFontSize) => void;
  setEditorLineWidth: (width: EditorLineWidth) => void;
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
  /** Tint dialogue in the prose editor. Off by default: it is noise while drafting. */
  highlightDialogue: boolean;
  setHighlightDialogue: (on: boolean) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // View state: normal | focus (sidebar hover-reveal)
  viewState: "normal" | "focus";
  setViewState: (state: "normal" | "focus") => void;

  // Sidebar collapsed (icon rail vs full panel)
  // The story strip (doc 11 P3): how wide the book is drawn, and what colours its stops.
  stripWidth: StripWidth;
  setStripWidth: (width: StripWidth) => void;
  /**
   * Beside the prose, or on any other page (doc 24): off the prose the strip starts
   * collapsed, and a width chosen there lasts only until you are back at the prose, which
   * keeps its own.
   */
  stripOnProse: boolean;
  setStripOnProse: (onProse: boolean) => void;
  /** The expanded strip's width (doc 14 strip). */
  stripPx: number;
  setStripPx: (px: number) => void;
  stripColourMode: ColourMode;
  setStripColourMode: (mode: ColourMode) => void;

  // Sprint timer
  sprintActive: boolean;
  sprintStartTime: number | null;
  sprintDuration: number;
  sprintGoalWords: number;
  sprintStartWordCount: number;
  startSprint: (duration: number, goalWords: number, startWordCount: number) => void;
  endSprint: () => void;

  // Brainstorm panel ("What's Next?")
  brainstormPanelOpen: boolean;
  openBrainstormPanel: () => void;
  closeBrainstormPanel: () => void;
  /** "Story so far" summary panel in the editor. Here rather than in the component so the
   *  palette can open it — the scene topbar no longer carries AI entries (doc 06 §10). */
  storySummaryOpen: boolean;
  toggleStorySummary: () => void;
  closeStorySummary: () => void;

  // Scene Planner panel
  plannerPanelOpen: boolean;
  openPlannerPanel: () => void;
  closePlannerPanel: () => void;

  // The editor's side panel: the scene's notes or the story's plan (palette → SceneEditor)

  // Dialogue insert trigger (command palette → SceneEditor)
  dialogueInsertTrigger: number;
  triggerDialogueInsert: () => void;

  // Writing guides modal trigger (command palette → SceneEditor)
  writingGuidesTab: "dialogue" | "mice" | "essential" | null;
  openWritingGuides: (tab: "dialogue" | "mice" | "essential") => void;
  closeWritingGuides: () => void;

  // World Building AI panel
  worldBuildingAIPanelOpen: boolean;
  worldBuildingAIContext: WorldBuildingAIContext | null;
  openWorldBuildingAIPanel: (ctx: WorldBuildingAIContext) => void;
  closeWorldBuildingAIPanel: () => void;

  // Scene search (⌘F — inline find bar in editor)
  sceneSearchOpen: boolean;
  openSceneSearch: () => void;
  closeSceneSearch: () => void;

  // Story-wide search (slide-out panel; the combo lives in lib/keyboard/shortcuts.ts)
  storySearchOpen: boolean;
  openStorySearch: () => void;
  /** The Export dialog (components/manuscript/ExportDialog.tsx), openable from anywhere. */
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  closeStorySearch: () => void;

  // Scratch pad (slide-in drawer; the combo lives in lib/keyboard/shortcuts.ts)
  scratchPadOpen: boolean;
  toggleScratchPad: () => void;
  closeScratchPad: () => void;
}

export interface WorldBuildingAIContext {
  feature:
    | "what-exists"
    | "location-suggest"
    | "culture-suggest"
    | "implications"
    | "system"
    | "calendar"
    | "travel";
  entityId: string;
  storyId: string;
}

// "System" follows the OS while it is chosen, not only when the page loads (doc 17).
const systemDark =
  typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;
systemDark?.addEventListener?.("change", () => {
  const { themeName, colorMode } = useUIStore.getState();
  if (colorMode === "system") applyAppearance(themeName, colorMode);
});

/** The strip's width beside the prose, as the author last left it there. */
function storedStripWidth(): StripWidth {
  // "chapters" was the second expanded view (retired, doc 24): it opens as the outline now.
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("ls_strip_width");
  } catch {
    // Site data blocked: start collapsed.
  }
  return saved === "chapters" || saved === "scenes" ? "scenes" : "strip";
}

function applyAppearance(themeName: ThemeName, colorMode: ColorMode) {
  const root = document.documentElement;

  // Swap theme class
  root.dataset.theme = themeName;

  // Dark-only themes always use dark mode
  const effectiveMode = THEME_META[themeName].darkOnly ? "dark" : colorMode;

  if (effectiveMode === "dark") {
    root.classList.add("dark");
  } else if (effectiveMode === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }
}

function applyEditorFont(fontFamily: EditorFontFamily, fontSize: EditorFontSize) {
  const root = document.documentElement;
  root.style.setProperty("--font-editor", getFontStack(fontFamily));
  root.style.setProperty("--font-size-editor", FONT_SIZES[fontSize]);
}

function applyUiScale(scale: UiScale) {
  document.documentElement.style.setProperty("--ui-scale", String(scaleFactor(scale)));
}

function applyEditorLineWidth(lineWidth: EditorLineWidth) {
  document.documentElement.style.setProperty("--editor-max-width", LINE_WIDTHS[lineWidth]);
}

// Migrate old format: ls_theme used to store "light" | "dark" | "system"
const OLD_COLOR_MODES = ["light", "dark", "system"];
const rawTheme = localStorage.getItem("ls_theme");
if (rawTheme && OLD_COLOR_MODES.includes(rawTheme)) {
  localStorage.setItem("ls_theme", "zen");
  localStorage.setItem("ls_color_mode", rawTheme);
}

// Migrate old category-based font names to specific font identifiers
const FONT_MIGRATION: Record<string, EditorFontFamily> = {
  serif: "merriweather",
  sans: "inter",
  mono: "jetbrains-mono",
  typewriter: "courier-prime",
};

const VALID_FONT_FAMILIES = FONT_OPTIONS.map((f) => f.value);
const VALID_FONT_SIZES: EditorFontSize[] = ["small", "medium", "large", "xl"];
const VALID_LINE_WIDTHS: EditorLineWidth[] = ["narrow", "medium", "wide", "full"];

// The editor's dialogue tints read this attribute (SceneEditor.module.css).
function applyHighlightDialogue(on: boolean) {
  document.documentElement.dataset.dialogueHighlight = on ? "on" : "off";
}

/** The author's choices as the browser keeps them (the account's copy, lib/preferences). */
function readSavedPrefs() {
  const theme = localStorage.getItem("ls_theme") as ThemeName;
  const mode = localStorage.getItem("ls_color_mode") as ColorMode;
  const rawFont = localStorage.getItem("ls_editor_font") ?? "";
  const font = FONT_MIGRATION[rawFont] ?? rawFont;
  const size = localStorage.getItem("ls_editor_font_size") as EditorFontSize;
  const width = localStorage.getItem("ls_editor_line_width") as EditorLineWidth;
  const scale = localStorage.getItem("ls_ui_scale");
  const colour = localStorage.getItem("ls_strip_colour");
  return {
    themeName: ALL_THEME_NAMES.includes(theme) ? theme : ("zen" as ThemeName),
    colorMode: OLD_COLOR_MODES.includes(mode) ? mode : ("system" as ColorMode),
    editorFontFamily: VALID_FONT_FAMILIES.includes(font as EditorFontFamily)
      ? (font as EditorFontFamily)
      : ("merriweather" as EditorFontFamily),
    editorFontSize: VALID_FONT_SIZES.includes(size) ? size : ("medium" as EditorFontSize),
    editorLineWidth: VALID_LINE_WIDTHS.includes(width) ? width : ("medium" as EditorLineWidth),
    uiScale: isUiScale(scale) ? scale : ("default" as UiScale),
    highlightDialogue: localStorage.getItem("ls_highlight_dialogue") === "on",
    // Read against the mode table, so a mode added there (Findings, doc 12 P4) survives a reload.
    stripColourMode: (COLOUR_MODES.some((m) => m.id === colour) ? colour : "none") as ColourMode,
  };
}

function applySavedPrefs(prefs: ReturnType<typeof readSavedPrefs>) {
  applyAppearance(prefs.themeName, prefs.colorMode);
  applyEditorFont(prefs.editorFontFamily, prefs.editorFontSize);
  applyEditorLineWidth(prefs.editorLineWidth);
  applyUiScale(prefs.uiScale);
  applyHighlightDialogue(prefs.highlightDialogue);
}

const savedPrefs = readSavedPrefs();
applySavedPrefs(savedPrefs);

for (const stale of [
  "ls_tree_height",
  "ls_tree_expanded",
  "ls_tree_detached",
  "ls_tree_panel_width",
  "ls_sidebar_collapsed",
  "ls_sidebar_closed",
  "ls_ai_panel_width",
  "ls_ai_panel_rect",
  "ls_ai_panel_open",
  // The panel's open state per side, writing open by default (now one choice, ls_panel_shown).
  "ls_panel_open",
  "ls_panel_open_pages",
  // Story Health's action toolbar (retired, doc 12 P4).
  "ls_health_actions_collapsed",
  "ls_health_actions_tab",
  // The strip's "1 of 7 / 5%" readout and its Chapters/Scenes choice (retired, doc 24).
  "ls_strip_readout",
  "ls_strip_depth",
]) {
  try {
    localStorage.removeItem(stale);
  } catch {
    /* nothing to tidy */
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  ...savedPrefs,
  setThemeName: (themeName) => {
    rememberPref("ls_theme", themeName);
    let { colorMode } = useUIStore.getState();
    if (THEME_META[themeName].darkOnly) {
      colorMode = "dark";
      rememberPref("ls_color_mode", "dark");
    }
    applyAppearance(themeName, colorMode);
    set({ themeName, ...(THEME_META[themeName].darkOnly ? { colorMode: "dark" } : {}) });
  },
  setColorMode: (colorMode) => {
    rememberPref("ls_color_mode", colorMode);
    const { themeName } = useUIStore.getState();
    applyAppearance(themeName, colorMode);
    set({ colorMode });
  },

  setEditorFontFamily: (editorFontFamily) => {
    rememberPref("ls_editor_font", editorFontFamily);
    const { editorFontSize } = useUIStore.getState();
    applyEditorFont(editorFontFamily, editorFontSize);
    set({ editorFontFamily });
  },
  setEditorFontSize: (editorFontSize) => {
    rememberPref("ls_editor_font_size", editorFontSize);
    const { editorFontFamily } = useUIStore.getState();
    applyEditorFont(editorFontFamily, editorFontSize);
    set({ editorFontSize });
  },
  setEditorLineWidth: (editorLineWidth) => {
    rememberPref("ls_editor_line_width", editorLineWidth);
    applyEditorLineWidth(editorLineWidth);
    set({ editorLineWidth });
  },
  setUiScale: (uiScale) => {
    rememberPref("ls_ui_scale", uiScale);
    applyUiScale(uiScale);
    set({ uiScale });
  },
  setHighlightDialogue: (highlightDialogue) => {
    rememberPref("ls_highlight_dialogue", highlightDialogue ? "on" : "off");
    applyHighlightDialogue(highlightDialogue);
    set({ highlightDialogue });
  },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  viewState: "normal",
  setViewState: (state) => set({ viewState: state }),

  stripWidth: storedStripWidth(),
  setStripWidth: (width) => {
    if (get().stripOnProse) {
      try {
        localStorage.setItem("ls_strip_width", width);
      } catch {
        // Site data blocked: the strip still works, it just forgets between visits.
      }
    }
    set({ stripWidth: width });
  },
  stripOnProse: true,
  setStripOnProse: (onProse) => {
    if (get().stripOnProse === onProse) return;
    set({ stripOnProse: onProse, stripWidth: onProse ? storedStripWidth() : "strip" });
  },
  stripPx: clampStripPx(Number(localStorage.getItem("ls_strip_px") ?? EXPANDED_DEFAULT_PX)),
  setStripPx: (px) => {
    const clamped = clampStripPx(px);
    try {
      localStorage.setItem("ls_strip_px", String(clamped));
    } catch {
      // As above.
    }
    set({ stripPx: clamped });
  },
  setStripColourMode: (mode) => {
    rememberPref("ls_strip_colour", mode);
    set({ stripColourMode: mode });
  },

  sprintActive: false,
  sprintStartTime: null,
  sprintDuration: 25,
  sprintGoalWords: 500,
  sprintStartWordCount: 0,
  startSprint: (duration, goalWords, startWordCount) =>
    set({
      sprintActive: true,
      sprintStartTime: Date.now(),
      sprintDuration: duration,
      sprintGoalWords: goalWords,
      sprintStartWordCount: startWordCount,
    }),
  endSprint: () => set({ sprintActive: false, sprintStartTime: null }),

  brainstormPanelOpen: false,
  openBrainstormPanel: () => set({ brainstormPanelOpen: true }),
  closeBrainstormPanel: () => set({ brainstormPanelOpen: false }),
  storySummaryOpen: false,
  toggleStorySummary: () => set((state) => ({ storySummaryOpen: !state.storySummaryOpen })),
  closeStorySummary: () => set({ storySummaryOpen: false }),

  plannerPanelOpen: false,
  openPlannerPanel: () => set({ plannerPanelOpen: true }),
  closePlannerPanel: () => set({ plannerPanelOpen: false }),

  dialogueInsertTrigger: 0,
  triggerDialogueInsert: () => set((s) => ({ dialogueInsertTrigger: s.dialogueInsertTrigger + 1 })),

  writingGuidesTab: null,
  openWritingGuides: (tab) => set({ writingGuidesTab: tab }),
  closeWritingGuides: () => set({ writingGuidesTab: null }),

  worldBuildingAIPanelOpen: false,
  worldBuildingAIContext: null,
  openWorldBuildingAIPanel: (ctx) => set({ worldBuildingAIPanelOpen: true, worldBuildingAIContext: ctx }),
  closeWorldBuildingAIPanel: () => set({ worldBuildingAIPanelOpen: false, worldBuildingAIContext: null }),

  sceneSearchOpen: false,
  openSceneSearch: () => set({ sceneSearchOpen: true }),
  closeSceneSearch: () => set({ sceneSearchOpen: false }),

  storySearchOpen: false,
  openStorySearch: () => set({ storySearchOpen: true }),
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  closeStorySearch: () => set({ storySearchOpen: false }),

  scratchPadOpen: false,
  toggleScratchPad: () => set((s) => ({ scratchPadOpen: !s.scratchPadOpen })),
  closeScratchPad: () => set({ scratchPadOpen: false }),
}));

// The account's choices replaced the browser's (another device chose them): show them.
window.addEventListener(PREFS_ADOPTED_EVENT, () => {
  const prefs = readSavedPrefs();
  applySavedPrefs(prefs);
  useUIStore.setState(prefs);
});
