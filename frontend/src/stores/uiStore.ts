import { create } from "zustand";

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
export type EditorLineWidth = "narrow" | "medium" | "wide";

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

export const LINE_WIDTHS: Record<EditorLineWidth, string> = {
  narrow: "520px",
  medium: "640px",
  wide: "800px",
};

export const FONT_SIZES: Record<EditorFontSize, string> = {
  small: "0.875rem",
  medium: "1rem",
  large: "1.125rem",
  xl: "1.25rem",
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

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // View state: normal | focus (sidebar hover-reveal)
  viewState: "normal" | "focus";
  setViewState: (state: "normal" | "focus") => void;

  // Sidebar collapsed (icon rail vs full panel)
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Structure tree height (resizable, Write tab only)
  treeHeight: number;
  setTreeHeight: (height: number) => void;

  // Structure tree expanded/collapsed
  treeExpanded: boolean;
  setTreeExpanded: (expanded: boolean) => void;

  // Structure tree detached to second panel
  treeDetached: boolean;
  setTreeDetached: (detached: boolean) => void;
  treePanelWidth: number;
  setTreePanelWidth: (width: number) => void;

  // Sprint timer
  sprintActive: boolean;
  sprintStartTime: number | null;
  sprintDuration: number;
  sprintGoalWords: number;
  sprintStartWordCount: number;
  startSprint: (duration: number, goalWords: number, startWordCount: number) => void;
  endSprint: () => void;

  // Story view mode
  viewMode: "tree" | "storyboard" | "summary" | "manuscript" | "todos";
  setViewMode: (mode: "tree" | "storyboard" | "summary" | "manuscript" | "todos") => void;

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

function applyEditorLineWidth(lineWidth: EditorLineWidth) {
  document.documentElement.style.setProperty("--editor-max-width", LINE_WIDTHS[lineWidth]);
}

// Migrate old format: ls_theme used to store "light" | "dark" | "system"
const OLD_COLOR_MODES = ["light", "dark", "system"];
const rawTheme = localStorage.getItem("ls_theme");

let savedThemeName: ThemeName = "zen";
let savedColorMode: ColorMode = "system";

if (rawTheme && OLD_COLOR_MODES.includes(rawTheme)) {
  // Old single-field format — migrate
  savedColorMode = rawTheme as ColorMode;
  localStorage.setItem("ls_theme", "zen");
  localStorage.setItem("ls_color_mode", rawTheme);
} else {
  const t = rawTheme as ThemeName;
  savedThemeName = ALL_THEME_NAMES.includes(t) ? t : "zen";
  const m = localStorage.getItem("ls_color_mode") as ColorMode;
  savedColorMode = OLD_COLOR_MODES.includes(m) ? m : "system";
}

applyAppearance(savedThemeName, savedColorMode);

// Migrate old category-based font names to specific font identifiers
const FONT_MIGRATION: Record<string, EditorFontFamily> = {
  serif: "merriweather",
  sans: "inter",
  mono: "jetbrains-mono",
  typewriter: "courier-prime",
};

const VALID_FONT_FAMILIES = FONT_OPTIONS.map((f) => f.value);
const VALID_FONT_SIZES: EditorFontSize[] = ["small", "medium", "large", "xl"];
const VALID_LINE_WIDTHS: EditorLineWidth[] = ["narrow", "medium", "wide"];

const rawEditorFont = localStorage.getItem("ls_editor_font") ?? "";
const migratedFont = FONT_MIGRATION[rawEditorFont] ?? rawEditorFont;
const savedEditorFont: EditorFontFamily = VALID_FONT_FAMILIES.includes(migratedFont as EditorFontFamily)
  ? (migratedFont as EditorFontFamily)
  : "merriweather";

const rawEditorSize = localStorage.getItem("ls_editor_font_size") as EditorFontSize;
const savedEditorSize: EditorFontSize = VALID_FONT_SIZES.includes(rawEditorSize) ? rawEditorSize : "medium";

const rawLineWidth = localStorage.getItem("ls_editor_line_width") as EditorLineWidth;
const savedLineWidth: EditorLineWidth = VALID_LINE_WIDTHS.includes(rawLineWidth) ? rawLineWidth : "medium";

applyEditorFont(savedEditorFont, savedEditorSize);
applyEditorLineWidth(savedLineWidth);

export const useUIStore = create<UIState>((set) => ({
  themeName: savedThemeName,
  colorMode: savedColorMode,
  setThemeName: (themeName) => {
    localStorage.setItem("ls_theme", themeName);
    let { colorMode } = useUIStore.getState();
    if (THEME_META[themeName].darkOnly) {
      colorMode = "dark";
      localStorage.setItem("ls_color_mode", "dark");
    }
    applyAppearance(themeName, colorMode);
    set({ themeName, ...(THEME_META[themeName].darkOnly ? { colorMode: "dark" } : {}) });
  },
  setColorMode: (colorMode) => {
    localStorage.setItem("ls_color_mode", colorMode);
    const { themeName } = useUIStore.getState();
    applyAppearance(themeName, colorMode);
    set({ colorMode });
  },

  editorFontFamily: savedEditorFont,
  editorFontSize: savedEditorSize,
  editorLineWidth: savedLineWidth,
  setEditorFontFamily: (editorFontFamily) => {
    localStorage.setItem("ls_editor_font", editorFontFamily);
    const { editorFontSize } = useUIStore.getState();
    applyEditorFont(editorFontFamily, editorFontSize);
    set({ editorFontFamily });
  },
  setEditorFontSize: (editorFontSize) => {
    localStorage.setItem("ls_editor_font_size", editorFontSize);
    const { editorFontFamily } = useUIStore.getState();
    applyEditorFont(editorFontFamily, editorFontSize);
    set({ editorFontSize });
  },
  setEditorLineWidth: (editorLineWidth) => {
    localStorage.setItem("ls_editor_line_width", editorLineWidth);
    applyEditorLineWidth(editorLineWidth);
    set({ editorLineWidth });
  },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  viewState: "normal",
  setViewState: (state) => set({ viewState: state }),

  sidebarCollapsed: localStorage.getItem("ls_sidebar_collapsed") === "true",
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem("ls_sidebar_collapsed", String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  treeHeight: Number(localStorage.getItem("ls_tree_height") ?? 200),
  setTreeHeight: (height) => {
    localStorage.setItem("ls_tree_height", String(height));
    set({ treeHeight: height });
  },

  treeExpanded: localStorage.getItem("ls_tree_expanded") !== "false",
  setTreeExpanded: (expanded) => {
    localStorage.setItem("ls_tree_expanded", String(expanded));
    set({ treeExpanded: expanded });
  },

  treeDetached: localStorage.getItem("ls_tree_detached") === "true",
  setTreeDetached: (detached) => {
    localStorage.setItem("ls_tree_detached", String(detached));
    set({ treeDetached: detached });
  },

  treePanelWidth: Number(localStorage.getItem("ls_tree_panel_width") ?? 200),
  setTreePanelWidth: (width) => {
    localStorage.setItem("ls_tree_panel_width", String(width));
    set({ treePanelWidth: width });
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

  viewMode: "tree" as "tree" | "storyboard" | "summary" | "manuscript" | "todos",
  setViewMode: (mode) => set({ viewMode: mode }),

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
  closeStorySearch: () => set({ storySearchOpen: false }),

  scratchPadOpen: false,
  toggleScratchPad: () => set((s) => ({ scratchPadOpen: !s.scratchPadOpen })),
  closeScratchPad: () => set({ scratchPadOpen: false }),
}));
