import { create } from "zustand";
import { api } from "../api/client";
import { ApiError } from "../api/request";
import { toolsApi, type UndoResult, type UndoState } from "../api/tools";
import { UNDO_APPLIED_EVENT } from "../lib/undo/events";
import { announceScenesRewritten } from "../lib/sceneEvents";
import { canRedoTyping, canUndoTyping, closeTyping, liveScene, replayTyping } from "../lib/undo/sceneHistory";
import {
  EMPTY_TIMELINE,
  act,
  forget,
  nextRedo,
  nextUndo,
  redid,
  undid,
  type Step,
  type Timeline,
} from "../lib/undo/timeline";
import { useStoryStore } from "./storyStore";

/**
 * The story's one undo timeline (doc 23 P5b): ⌘Z, ⇧⌘Z and the header's buttons all come
 * here, wherever focus is. Typing in the open scene and every change on the server are steps
 * in the order they happened; each is undone by the history that holds it.
 */
const EMPTY_SERVER: UndoState = { can_undo: false, undo_label: null, can_redo: false, redo_label: null };

interface UndoStoreState {
  storyId: string | null;
  timeline: Timeline;
  server: UndoState;
  busy: boolean;
  error: string | null;
  /** Bumped when the open editor's history moves, so labels re-read it. */
  version: number;
}

export const useUndoStore = create<UndoStoreState>(() => ({
  storyId: null,
  timeline: EMPTY_TIMELINE,
  server: EMPTY_SERVER,
  busy: false,
  error: null,
  version: 0,
}));

const set = useUndoStore.setState;
const get = useUndoStore.getState;

function liveForUndo(s: Step): boolean {
  return s.kind === "server" || canUndoTyping(s.nodeId, s.session);
}

function liveForRedo(s: Step): boolean {
  return s.kind === "server" || canRedoTyping(s.nodeId, s.session);
}

/** A new story: a new timeline, and the server's state for it. */
export function setUndoStory(storyId: string | null): void {
  if (get().storyId === storyId) return;
  set({ storyId, timeline: EMPTY_TIMELINE, server: EMPTY_SERVER, error: null });
  refreshServer();
}

export async function refreshServer(): Promise<void> {
  const storyId = get().storyId;
  if (!storyId) return;
  try {
    const server = await toolsApi.undoState(storyId);
    if (get().storyId === storyId) set({ server });
  } catch {
    if (get().storyId === storyId) set({ server: EMPTY_SERVER });
  }
}

/** The open scene's history took a new step: the author typed. */
export function typed(): void {
  const scene = liveScene();
  if (!scene || !get().storyId) return;
  set({ timeline: act(get().timeline, { kind: "editor", nodeId: scene.nodeId, session: scene.session }) });
}

/** A request recorded a change (from its response headers, or another window). */
export function serverActed(story: string, batch: string): void {
  if (story !== get().storyId) return;
  closeTyping();
  set({ timeline: act(get().timeline, { kind: "server", batch }) });
}

/** A server change undone outside the timeline (Chronicle › Changes): off the timeline. */
export function forgetChange(batch: string): void {
  set({ timeline: forget(get().timeline, batch) });
}

export function bumpVersion(): void {
  set({ version: get().version + 1 });
}

/** What ⌘Z and ⇧⌘Z would do now, for the header's buttons. */
export function undoView(): {
  canUndo: boolean;
  undoLabel: string | null;
  canRedo: boolean;
  redoLabel: string | null;
} {
  const { timeline, server } = get();
  const u = nextUndo(timeline, liveForUndo).step;
  const r = nextRedo(timeline, liveForRedo).step;
  const typing = () => `typing in “${liveScene()?.title || "this scene"}”`;
  return {
    canUndo: u ? true : server.can_undo,
    undoLabel: u?.kind === "editor" ? typing() : server.undo_label,
    canRedo: r ? true : !timeline.touched && server.can_redo,
    redoLabel: r?.kind === "editor" ? typing() : server.redo_label,
  };
}

/**
 * ⌘Z (`undo`) or ⇧⌘Z (`redo`). `serverOnly` is for an offer that names a server change
 * (the "Deleted … · Undo" toast): it undoes that, even with typing since.
 */
export async function runUndo(kind: "undo" | "redo", { serverOnly = false } = {}): Promise<void> {
  const { storyId, busy } = get();
  if (!storyId || busy) return;
  const pick = kind === "undo" ? nextUndo : nextRedo;
  const { step: next, timeline } = pick(get().timeline, kind === "undo" ? liveForUndo : liveForRedo);
  set({ timeline, error: null });

  if (next?.kind === "editor" && !serverOnly) {
    if (replayTyping(kind)) set({ timeline: (kind === "undo" ? undid : redid)(get().timeline, next) });
    return;
  }
  // The server's change, or its own history from before this page (nothing live here).
  if (!next && (kind === "undo" ? !get().server.can_undo : get().timeline.touched || !get().server.can_redo))
    return;
  const step: Step = next?.kind === "server" ? next : { kind: "server", batch: null };
  set({ busy: true });
  try {
    await liveScene()?.flush();
    const result = kind === "undo" ? await toolsApi.undo(storyId) : await toolsApi.redo(storyId);
    if (serverOnly && next?.kind !== "server")
      set({ timeline: forget(get().timeline, null, { toRedo: true }) });
    else set({ timeline: (kind === "undo" ? undid : redid)(get().timeline, step) });
    await applyResult(storyId, result);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) set({ error: e.message });
    else if (!(e instanceof ApiError && e.status === 404)) set({ error: `Could not ${kind}` });
  } finally {
    set({ busy: false });
    refreshServer();
  }
}

/** Bring the page up to date with what an undo or redo changed. */
export async function applyResult(storyId: string, result: UndoResult): Promise<void> {
  const store = useStoryStore.getState();
  if (result.entity_type === "structure_node") {
    store.setStructure(await api.getStructure(storyId));
    const active = store.activeNode;
    if (active && !result.scene_ids?.includes(active.id)) {
      try {
        store.setActiveNode(await api.getNode(active.id));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) store.setActiveNode(null);
      }
    }
  } else if (result.entity_type === "character" || result.entity_type === "character_relationship") {
    store.setCharacters(await api.listCharacters(storyId));
  } else if (result.entity_type === "story") {
    store.setActiveStory(await api.getStory(storyId));
  }
  // The open scene's prose came back or went again: its editor lays the text in.
  announceScenesRewritten(result.scene_ids ?? []);
  window.dispatchEvent(new CustomEvent(UNDO_APPLIED_EVENT, { detail: result }));
}
