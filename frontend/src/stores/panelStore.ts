import { create } from "zustand";
import { entityTabId, toolTabId, type EntityKind, type PanelTab, type ToolId } from "../types/panel";
import { panelStartsOpen } from "../lib/layout/sides";

/**
 * The side panel (refactor doc 11): what is open beside the page. "This scene" is always
 * first and follows the open scene; everything else the author opened stays until they
 * close it, and comes back with the story. Per-browser, like the other layout choices,
 * so it lives in localStorage rather than on the account.
 */
export type PanelFrameMode = "docked" | "floating" | "window";

/**
 * Which side of the app the author is on (doc 12 P2). Writing, the panel is part of the
 * desk and opens by default; on any other page it is a reference you call up, so it starts
 * as the collapsed rail. Each side remembers its own choice.
 */
export type PanelSide = "writing" | "pages";

export interface Highlight {
  kind: EntityKind;
  id: string;
  name: string;
}

interface PanelState {
  storyId: string | null;
  tabs: PanelTab[];
  activeTabId: string;
  /** Open on the side the author is on now: `openBySide[side]`. */
  open: boolean;
  side: PanelSide;
  openBySide: Record<PanelSide, boolean>;
  /** Docked in the workspace row, floating over the page, or popped out to its own window. */
  frame: PanelFrameMode;
  /** The entity whose mentions light up in the prose and on the strip. */
  highlight: Highlight | null;

  loadForStory: (storyId: string) => void;
  /** Called when the route changes between the prose and every other page. */
  setSide: (side: PanelSide) => void;
  openEntity: (kind: EntityKind, id: string, label: string) => void;
  openTool: (tool: ToolId) => void;
  activate: (id: string) => void;
  close: (id: string) => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setFrame: (frame: PanelFrameMode) => void;
  toggleFloating: () => void;
  /** Show the Assistant tab (doc 11 P5, A2); it is not one of `tabs`, it is always there when AI is. */
  openAssistant: () => void;
  /** ⌘J: the Assistant tab if it is not showing, else back to the scene. */
  toggleAssistant: () => void;
  setHighlight: (h: Highlight | null) => void;
  /** Drop tabs whose entity no longer exists. */
  prune: (exists: (tab: PanelTab) => boolean) => void;
}

const SCENE_TAB: PanelTab = { id: "scene", kind: "scene" };
const OPEN_KEYS: Record<PanelSide, string> = { writing: "ls_panel_open", pages: "ls_panel_open_pages" };
const OPEN_DEFAULTS: Record<PanelSide, boolean> = { writing: true, pages: false };
const FRAME_KEY = "ls_panel_frame";
const tabsKey = (storyId: string) => `ls_panel:${storyId}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Site data blocked: the panel still works, it just forgets between visits.
  }
}

/** The entity a tab points at, for the highlight. */
function highlightOf(tab: PanelTab | undefined): Highlight | null {
  return tab?.kind === "entity" ? { kind: tab.entityKind, id: tab.entityId, name: tab.label } : null;
}

function persistTabs(storyId: string | null, tabs: PanelTab[], activeTabId: string) {
  if (!storyId) return;
  write(tabsKey(storyId), { tabs: tabs.filter((t) => t.kind !== "scene"), activeTabId });
}

const initialOpen: Record<PanelSide, boolean> = {
  writing: panelStartsOpen(
    read<boolean>(OPEN_KEYS.writing, OPEN_DEFAULTS.writing),
    typeof window === "undefined" ? Infinity : window.innerWidth,
  ),
  pages: read<boolean>(OPEN_KEYS.pages, OPEN_DEFAULTS.pages),
};

export const usePanelStore = create<PanelState>((set, get) => {
  /** What an open panel lights: its active entity tab. A shut panel lights nothing. */
  function lit(open: boolean): Highlight | null {
    const { tabs, activeTabId } = get();
    return open ? highlightOf(tabs.find((t) => t.id === activeTabId)) : null;
  }

  /** Open or collapse the panel on the current side, and remember it for that side. */
  function openOnSide(open: boolean): Pick<PanelState, "open" | "openBySide"> {
    const { side, openBySide } = get();
    write(OPEN_KEYS[side], open);
    return { open, openBySide: { ...openBySide, [side]: open } };
  }

  return {
    storyId: null,
    tabs: [SCENE_TAB],
    activeTabId: "scene",
    side: "writing",
    openBySide: initialOpen,
    open: initialOpen.writing,
    // "window" is never restored: a pop-out that is not there any more would leave a strip and no panel.
    frame: read<PanelFrameMode>(FRAME_KEY, "docked") === "floating" ? "floating" : "docked",
    highlight: null,

    loadForStory: (storyId) => {
      if (get().storyId === storyId) return;
      const saved = read<{ tabs: PanelTab[]; activeTabId: string }>(tabsKey(storyId), {
        tabs: [],
        activeTabId: "scene",
      });
      const tabs = [SCENE_TAB, ...saved.tabs.filter((t) => t.kind !== "scene")];
      const activeTabId =
        saved.activeTabId === "assistant" || tabs.some((t) => t.id === saved.activeTabId)
          ? saved.activeTabId
          : "scene";
      // The tab you left open comes back lit, the way it was when you left.
      const active = tabs.find((t) => t.id === activeTabId);
      set({
        storyId,
        tabs,
        activeTabId,
        highlight: get().open ? highlightOf(active) : null,
      });
    },

    setSide: (side) => {
      if (get().side === side) return;
      const open = get().openBySide[side];
      set({ side, open, highlight: lit(open) });
    },

    openEntity: (kind, id, label) => {
      const tabId = entityTabId(kind, id);
      const { tabs, storyId } = get();
      const next = tabs.some((t) => t.id === tabId)
        ? tabs
        : [...tabs, { id: tabId, kind: "entity" as const, entityKind: kind, entityId: id, label }];
      persistTabs(storyId, next, tabId);
      set({ tabs: next, activeTabId: tabId, highlight: { kind, id, name: label }, ...openOnSide(true) });
    },

    openTool: (tool) => {
      const tabId = toolTabId(tool);
      const { tabs, storyId } = get();
      const next = tabs.some((t) => t.id === tabId)
        ? tabs
        : [...tabs, { id: tabId, kind: "tool" as const, tool }];
      persistTabs(storyId, next, tabId);
      set({ tabs: next, activeTabId: tabId, ...openOnSide(true) });
    },

    activate: (id) => {
      const { tabs, storyId } = get();
      if (id === "assistant") return get().openAssistant();
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;
      persistTabs(storyId, tabs, id);
      set({ activeTabId: id, highlight: highlightOf(tab), ...openOnSide(true) });
    },

    close: (id) => {
      if (id === "scene") return;
      if (id === "assistant") return get().activate("scene");
      const { tabs, activeTabId, storyId } = get();
      const index = tabs.findIndex((t) => t.id === id);
      if (index < 0) return;
      const next = tabs.filter((t) => t.id !== id);
      // Closing the open tab lands on its neighbour, the way browser tabs do.
      const nextActive =
        activeTabId === id ? (next[Math.min(index, next.length - 1)]?.id ?? "scene") : activeTabId;
      persistTabs(storyId, next, nextActive);
      const active = next.find((t) => t.id === nextActive);
      set({
        tabs: next,
        activeTabId: nextActive,
        highlight: highlightOf(active),
      });
    },

    // A shut panel lights nothing: the strip's dots and the prose's marks follow an open tab.
    setOpen: (open) => set({ ...openOnSide(open), highlight: lit(open) }),
    toggle: () => get().setOpen(!get().open),

    setFrame: (frame) => {
      if (frame !== "window") write(FRAME_KEY, frame);
      set({ frame, ...openOnSide(true) });
    },
    toggleFloating: () => get().setFrame(get().frame === "floating" ? "docked" : "floating"),

    openAssistant: () => {
      const { tabs, storyId } = get();
      persistTabs(storyId, tabs, "assistant");
      set({ activeTabId: "assistant", highlight: null, ...openOnSide(true) });
    },
    toggleAssistant: () => {
      const { open, activeTabId } = get();
      if (open && activeTabId === "assistant") get().activate("scene");
      else get().openAssistant();
    },

    setHighlight: (highlight) => set({ highlight }),

    prune: (exists) => {
      const { tabs, activeTabId, storyId } = get();
      const next = tabs.filter((t) => t.kind !== "entity" || exists(t));
      if (next.length === tabs.length) return;
      const nextActive = next.some((t) => t.id === activeTabId) ? activeTabId : "scene";
      persistTabs(storyId, next, nextActive);
      set({ tabs: next, activeTabId: nextActive });
    },
  };
});

/** The highlighted entity's name, for code outside React (the editor's decorations). */
export function currentHighlight(): Highlight | null {
  return usePanelStore.getState().highlight;
}
