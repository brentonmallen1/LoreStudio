import { create } from "zustand";
import {
  TOOL_LABELS,
  entityTabId,
  toolTabId,
  type EntityKind,
  type PanelTab,
  type ToolId,
} from "../types/panel";
import { panelStartsOpen } from "../lib/layout/sides";
import { DEFAULT_PROSE_AMOUNT, PROSE_AMOUNTS, type ProseAmount } from "../lib/panel/sequence";

/**
 * The side panel (refactor doc 11): what is open beside the page. "This scene" is always
 * first and follows the open scene; everything else the author opened stays until they
 * close it, and comes back with the story. Per-browser, like the other layout choices,
 * so it lives in localStorage rather than on the account.
 */
export type PanelFrameMode = "docked" | "floating" | "window";

/**
 * Which side of the app the author is on (doc 12 P2): the prose, or any other page. It only
 * changes what the panel says (a scene tab names its scene off the prose) and what closing
 * the last tab does. Open or collapsed is one choice for every page: it starts as the
 * collapsed rail and moving between pages never changes it, only the author does.
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
  /** Open or collapsed, the same on every page until the author changes it. */
  open: boolean;
  side: PanelSide;
  /** Docked in the workspace row, floating over the page, or popped out to its own window. */
  frame: PanelFrameMode;
  /** The entity whose mentions light up in the prose and on the strip. */
  highlight: Highlight | null;
  /** Paragraphs of prose the This scene tab shows from the scenes either side. */
  proseAmount: ProseAmount;
  /** A scene further away, pinned read-only on top of the This scene tab (⌥-click on the strip). */
  pinnedSceneId: string | null;

  loadForStory: (storyId: string) => void;
  /** Called when the route changes between the prose and every other page; open stays as it is. */
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
  /** ⌘J: the Assistant tab if it is not showing, else back to the scene (shut, off the prose). */
  toggleAssistant: () => void;
  setHighlight: (h: Highlight | null) => void;
  setProseAmount: (n: ProseAmount) => void;
  /** Pin a scene on top of the This scene tab and show the tab; null unpins. */
  pinScene: (id: string | null) => void;
  /** Drop tabs whose entity no longer exists. */
  prune: (exists: (tab: PanelTab) => boolean) => void;
}

const SCENE_TAB: PanelTab = { id: "scene", kind: "scene" };
const OPEN_KEY = "ls_panel_shown";
const FRAME_KEY = "ls_panel_frame";
const PROSE_KEY = "ls_panel_prose";
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

const initialOpen = panelStartsOpen(
  read<boolean>(OPEN_KEY, false),
  typeof window === "undefined" ? Infinity : window.innerWidth,
);

export const usePanelStore = create<PanelState>((set, get) => {
  /** What an open panel lights: its active entity tab. A shut panel lights nothing. */
  function lit(open: boolean): Highlight | null {
    const { tabs, activeTabId } = get();
    return open ? highlightOf(tabs.find((t) => t.id === activeTabId)) : null;
  }

  /** Open or collapse the panel, and remember it for every page. */
  function openOnSide(open: boolean): Pick<PanelState, "open"> {
    write(OPEN_KEY, open);
    return { open };
  }

  /**
   * Leave a tab for the scene tab. While writing that shows the scene; on any other page the
   * scene tab is not something the author opened there, so the panel collapses instead of
   * staying open on every page with the last scene in it.
   */
  function backToScene(): void {
    const { tabs, storyId, side } = get();
    persistTabs(storyId, tabs, "scene");
    set({ activeTabId: "scene", highlight: null, ...openOnSide(side === "writing") });
  }

  return {
    storyId: null,
    tabs: [SCENE_TAB],
    activeTabId: "scene",
    side: "writing",
    open: initialOpen,
    // "window" is never restored: a pop-out that is not there any more would leave a strip and no panel.
    frame: read<PanelFrameMode>(FRAME_KEY, "docked") === "floating" ? "floating" : "docked",
    highlight: null,
    proseAmount: PROSE_AMOUNTS.find((n) => n === read<number>(PROSE_KEY, 0)) ?? DEFAULT_PROSE_AMOUNT,
    pinnedSceneId: null,

    loadForStory: (storyId) => {
      if (get().storyId === storyId) return;
      const saved = read<{ tabs: PanelTab[]; activeTabId: string }>(tabsKey(storyId), {
        tabs: [],
        activeTabId: "scene",
      });
      // A tool tab saved before its tool was renamed or removed (doc 15: questions → notes).
      const known = (t: PanelTab) => t.kind !== "scene" && (t.kind !== "tool" || t.tool in TOOL_LABELS);
      const tabs = [SCENE_TAB, ...saved.tabs.filter(known)];
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
        pinnedSceneId: null,
      });
    },

    setSide: (side) => {
      if (get().side !== side) set({ side });
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
      if (id === "assistant") return backToScene();
      const { tabs, activeTabId, storyId } = get();
      const index = tabs.findIndex((t) => t.id === id);
      if (index < 0) return;
      const next = tabs.filter((t) => t.id !== id);
      // Closing the open tab lands on its neighbour, the way browser tabs do.
      const nextActive =
        activeTabId === id ? (next[Math.min(index, next.length - 1)]?.id ?? "scene") : activeTabId;
      if (activeTabId === id && nextActive === "scene") {
        set({ tabs: next });
        return backToScene();
      }
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
      if (open && activeTabId === "assistant") backToScene();
      else get().openAssistant();
    },

    setHighlight: (highlight) => set({ highlight }),

    setProseAmount: (proseAmount) => {
      write(PROSE_KEY, proseAmount);
      set({ proseAmount });
    },

    pinScene: (id) => {
      if (!id) return set({ pinnedSceneId: null });
      const { tabs, storyId } = get();
      persistTabs(storyId, tabs, "scene");
      set({ pinnedSceneId: id, activeTabId: "scene", highlight: null, ...openOnSide(true) });
    },

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
