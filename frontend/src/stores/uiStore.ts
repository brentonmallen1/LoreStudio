import { create } from "zustand";
import type { Character, Interview } from "../types";

type Theme = "light" | "dark" | "system";

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Interview panel
  interviewPanelOpen: boolean;
  activeInterview: Interview | null;
  activeInterviewCharacter: Character | null;
  openInterview: (interview: Interview, character: Character) => void;
  closeInterviewPanel: () => void;
  collapseInterviewPanel: () => void;
  setActiveInterview: (interview: Interview) => void;

  // Focus mode
  focusMode: boolean;
  toggleFocusMode: () => void;

  // Story view mode
  viewMode: "tree" | "corkboard";
  setViewMode: (mode: "tree" | "corkboard") => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }
}

const savedTheme = (localStorage.getItem("ls_theme") as Theme) ?? "system";
applyTheme(savedTheme);

export const useUIStore = create<UIState>((set) => ({
  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem("ls_theme", theme);
    applyTheme(theme);
    set({ theme });
  },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  interviewPanelOpen: false,
  activeInterview: null,
  activeInterviewCharacter: null,
  openInterview: (interview, character) =>
    set({ interviewPanelOpen: true, activeInterview: interview, activeInterviewCharacter: character }),
  closeInterviewPanel: () =>
    set({ interviewPanelOpen: false, activeInterview: null, activeInterviewCharacter: null }),
  collapseInterviewPanel: () => set({ interviewPanelOpen: false }),
  setActiveInterview: (interview) => set({ activeInterview: interview }),

  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  viewMode: "tree",
  setViewMode: (mode) => set({ viewMode: mode }),
}));
