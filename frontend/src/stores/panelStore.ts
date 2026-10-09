import { create } from "zustand";
import {
  entityTabId,
  launcherId,
  launcherOf,
  pageTabId,
  type EntityKind,
  type Launcher,
  type PanelTab,
  type ToolId,
} from "../types/panel";
import { panelStartsOpen } from "../lib/layout/sides";
import { besidePath } from "../lib/panel/pages";
import { restorePanel } from "../lib/panel/restore";
import { DEFAULT_PROSE_AMOUNT, PROSE_AMOUNTS, type ProseAmount } from "../lib/panel/sequence";

/**
 * The side panel (refactor doc 11): what is beside the page. The rail launches and the tabs
 * hold (doc 24 D11): This scene, the tools and the Assistant show from the rail without
 * becoming tabs, and the strip holds only what the author opened (people, places, threads,
 * pages beside the prose), which stays until they close it and comes back with the story.
 * Per-browser, like the other layout choices, so it lives in localStorage, not the account.
 */
export type PanelFrameMode = "docked" | "floating" | "window";

/**
 * Which side of the app the author is on (doc 12 P2): the prose, or any other page. It
 * changes what the panel says (a scene tab names its scene off the prose) and what closing
 * the last tab does. Off the prose the panel starts collapsed (doc 24): opened there, it stays
 * open from page to page, and back at the prose it is as the author left it there.
 */
export type PanelSide = "writing" | "pages";

export interface Highlight {
  kind: EntityKind;
  id: string;
  name: string;
}

interface PanelState {
  storyId: string | null;
  /** What the author opened: entities and pages, never This scene or a tool. */
  tabs: PanelTab[];
  /** What the panel shows: a launcher ("scene", "assistant", "tool:notes") or one of `tabs`. */
  showing: string;
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
  /** Show This scene, a tool or the Assistant from the rail; no tab is added. */
  launch: (launcher: Launcher) => void;
  /** Open it as a tab and show it; `behind` adds the tab and leaves the one showing (⌘-click in a list). */
  openEntity: (kind: EntityKind, id: string, label: string, behind?: boolean) => void;
  /** A page beside the prose (doc 24 D2), at one of its sections if named; one tab per page. */
  openPage: (routeId: string, sectionId?: string) => void;
  /** Where a page tab is now, after a move inside it (a section, an entry). */
  setPagePath: (tabId: string, path: string) => void;
  openTool: (tool: ToolId) => void;
  /** Show a launcher or a tab by its id. */
  activate: (id: string) => void;
  /** Close a tab; for a launcher, leave it for This scene. */
  close: (id: string) => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setFrame: (frame: PanelFrameMode) => void;
  toggleFloating: () => void;
  /** Show the Assistant (doc 11 P5, A2); it is on the rail, never a tab. */
  openAssistant: () => void;
  /** ⌘J: the Assistant if it is not showing, else back to the scene (shut, off the prose). */
  toggleAssistant: () => void;
  setHighlight: (h: Highlight | null) => void;
  setProseAmount: (n: ProseAmount) => void;
  /** Pin a scene on top of the This scene tab and show the tab; null unpins. */
  pinScene: (id: string | null) => void;
  /** Drop tabs whose entity no longer exists. */
  prune: (exists: (tab: PanelTab) => boolean) => void;
}

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

function persist(storyId: string | null, tabs: PanelTab[], showing: string) {
  if (!storyId) return;
  write(tabsKey(storyId), { tabs, showing });
}

const initialOpen = panelStartsOpen(
  read<boolean>(OPEN_KEY, false),
  typeof window === "undefined" ? Infinity : window.innerWidth,
);

export const usePanelStore = create<PanelState>((set, get) => {
  /** What an open panel lights: the entity tab showing. A shut panel lights nothing. */
  function lit(open: boolean): Highlight | null {
    const { tabs, showing } = get();
    return open ? highlightOf(tabs.find((t) => t.id === showing)) : null;
  }

  /** Open or collapse the panel; beside the prose, remember it for the next time there. */
  function openOnSide(open: boolean): Pick<PanelState, "open"> {
    if (get().side === "writing") write(OPEN_KEY, open);
    return { open };
  }

  /** Show something already in reach (a launcher, or a tab in `tabs`), opening the panel. */
  function show(showing: string, tabs = get().tabs): void {
    persist(get().storyId, tabs, showing);
    set({ tabs, showing, highlight: highlightOf(tabs.find((t) => t.id === showing)), ...openOnSide(true) });
  }

  /**
   * Leave what is showing for This scene. While writing that shows the scene; on any other page
   * the scene is not something the author opened there, so the panel collapses instead of
   * staying open on every page with the last scene in it.
   */
  function backToScene(tabs = get().tabs): void {
    const { storyId, side } = get();
    persist(storyId, tabs, "scene");
    set({ tabs, showing: "scene", highlight: null, ...openOnSide(side === "writing") });
  }

  return {
    storyId: null,
    tabs: [],
    showing: "scene",
    side: "writing",
    open: initialOpen,
    // "window" is never restored: a pop-out that is not there any more would leave a strip and no panel.
    frame: read<PanelFrameMode>(FRAME_KEY, "docked") === "floating" ? "floating" : "docked",
    highlight: null,
    proseAmount: PROSE_AMOUNTS.find((n) => n === read<number>(PROSE_KEY, 0)) ?? DEFAULT_PROSE_AMOUNT,
    pinnedSceneId: null,

    loadForStory: (storyId) => {
      if (get().storyId === storyId) return;
      const { tabs, showing } = restorePanel(read<unknown>(tabsKey(storyId), null));
      // What you left showing comes back lit, the way it was when you left.
      set({
        storyId,
        tabs,
        showing,
        highlight: get().open ? highlightOf(tabs.find((t) => t.id === showing)) : null,
        pinnedSceneId: null,
      });
    },

    setSide: (side) => {
      if (get().side === side) return;
      // A panel popped out to its own window is not beside any page.
      if (get().frame === "window") return set({ side });
      const open = side === "writing" && read<boolean>(OPEN_KEY, false);
      set({
        side,
        open,
        highlight: open ? highlightOf(get().tabs.find((t) => t.id === get().showing)) : null,
      });
    },

    launch: (launcher) => show(launcherId(launcher)),

    openEntity: (kind, id, label, behind = false) => {
      const tabId = entityTabId(kind, id);
      const { tabs, storyId, showing } = get();
      const next = tabs.some((t) => t.id === tabId)
        ? tabs
        : [...tabs, { id: tabId, kind: "entity" as const, entityKind: kind, entityId: id, label }];
      if (behind) {
        persist(storyId, next, showing);
        return set({ tabs: next });
      }
      show(tabId, next);
    },

    openPage: (routeId, sectionId) => {
      const path = besidePath(routeId, sectionId);
      if (path === null) return;
      const tabId = pageTabId(routeId);
      const { tabs } = get();
      const tab: PanelTab = { id: tabId, kind: "page", routeId, path };
      const next = tabs.some((t) => t.id === tabId)
        ? tabs.map((t) => (t.id === tabId && sectionId ? tab : t))
        : [...tabs, tab];
      // Beside the prose: open there too, so a page opened from elsewhere is waiting at the prose.
      write(OPEN_KEY, true);
      show(tabId, next);
    },

    setPagePath: (tabId, path) => {
      const { tabs, storyId, showing } = get();
      const next = tabs.map((t) => (t.id === tabId && t.kind === "page" ? { ...t, path } : t));
      persist(storyId, next, showing);
      set({ tabs: next });
    },

    openTool: (tool) => get().launch(tool),

    activate: (id) => {
      if (id === "assistant") return get().openAssistant();
      if (launcherOf(id) || get().tabs.some((t) => t.id === id)) show(id);
    },

    close: (id) => {
      const { tabs, showing, storyId } = get();
      if (launcherOf(id)) {
        if (id !== "scene" && showing === id) backToScene();
        return;
      }
      const index = tabs.findIndex((t) => t.id === id);
      if (index < 0) return;
      const next = tabs.filter((t) => t.id !== id);
      if (showing !== id) {
        persist(storyId, next, showing);
        return set({ tabs: next });
      }
      // Closing the tab showing lands on its neighbour, the way browser tabs do; with none
      // left, back to the scene.
      const neighbour = next[Math.min(index, next.length - 1)];
      if (!neighbour) return backToScene(next);
      persist(storyId, next, neighbour.id);
      set({ tabs: next, showing: neighbour.id, highlight: highlightOf(neighbour) });
    },

    // A shut panel lights nothing: the strip's dots and the prose's marks follow an open tab.
    setOpen: (open) => set({ ...openOnSide(open), highlight: lit(open) }),
    toggle: () => get().setOpen(!get().open),

    setFrame: (frame) => {
      if (frame !== "window") write(FRAME_KEY, frame);
      set({ frame, ...openOnSide(true) });
    },
    toggleFloating: () => get().setFrame(get().frame === "floating" ? "docked" : "floating"),

    openAssistant: () => show("assistant"),
    toggleAssistant: () => {
      const { open, showing } = get();
      if (open && showing === "assistant") backToScene();
      else get().openAssistant();
    },

    setHighlight: (highlight) => set({ highlight }),

    setProseAmount: (proseAmount) => {
      write(PROSE_KEY, proseAmount);
      set({ proseAmount });
    },

    pinScene: (id) => {
      if (!id) return set({ pinnedSceneId: null });
      set({ pinnedSceneId: id });
      show("scene");
    },

    prune: (exists) => {
      const { tabs, showing, storyId } = get();
      const next = tabs.filter((t) => t.kind !== "entity" || exists(t));
      if (next.length === tabs.length) return;
      const nextShowing = launcherOf(showing) || next.some((t) => t.id === showing) ? showing : "scene";
      persist(storyId, next, nextShowing);
      set({ tabs: next, showing: nextShowing });
    },
  };
});

/** The highlighted entity's name, for code outside React (the editor's decorations). */
export function currentHighlight(): Highlight | null {
  return usePanelStore.getState().highlight;
}
