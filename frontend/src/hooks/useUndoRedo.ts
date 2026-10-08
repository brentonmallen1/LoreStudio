import { useEffect, useRef } from "react";
import { MUTATION_EVENT, type MutationEventDetail } from "../api/request";
import { toolsApi, type UndoState } from "../api/tools";
import { changeChannel, UNDO_APPLIED_EVENT } from "../lib/undo/events";
import { onSceneHistory } from "../lib/undo/sceneHistory";
import { useStoryStore } from "../stores/storyStore";
import { toast, useToastStore } from "../stores/toastStore";
import {
  bumpVersion,
  refreshServer,
  runUndo,
  serverActed,
  setUndoStory,
  undoView,
  useUndoStore,
} from "../stores/undoStore";

export { UNDO_APPLIED_EVENT };

/**
 * Re-run `reload` after an undo or redo that touched one of `entityTypes`, for components
 * that hold their own copy of the rows. An event with no entity type reloads too. `reload`
 * may return a promise; its rejection is swallowed.
 */
export function useReloadOnUndo(entityTypes: readonly string[], reload: () => unknown) {
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });
  const key = entityTypes.join(",");
  useEffect(() => {
    const types = key.split(",");
    const onUndo = (e: Event) => {
      const d = (e as CustomEvent).detail as { entity_type?: string } | undefined;
      if (d?.entity_type && !types.includes(d.entity_type)) return;
      // A failed reload keeps what is on screen; the next edit or visit fetches again.
      Promise.resolve(reloadRef.current()).catch(() => {});
    };
    window.addEventListener(UNDO_APPLIED_EVENT, onUndo);
    return () => window.removeEventListener(UNDO_APPLIED_EVENT, onUndo);
  }, [key]);
}

/**
 * The header's view of the story's one undo timeline (doc 23 P5b; `stores/undoStore`). It
 * follows the active story, hears every change a request records (its response headers, or
 * another window), and re-reads the labels when the open editor's history moves.
 */
export function useUndoRedo() {
  const storyId = useStoryStore((s) => s.activeStory?.id ?? null);
  const busy = useUndoStore((s) => s.busy);
  const error = useUndoStore((s) => s.error);
  // Re-render on any move; the view is read from the store and the live editor below.
  useUndoStore((s) => s.timeline);
  useUndoStore((s) => s.server);
  useUndoStore((s) => s.version);
  // A delete just went through: offer its undo in a toast once the log has it (doc 23 P5).
  const offerUndo = useRef(false);

  useEffect(() => setUndoStory(storyId), [storyId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      await refreshServer();
      const id = useUndoStore.getState().storyId;
      if (offerUndo.current && id) {
        offerUndo.current = false;
        offerToUndo(id, useUndoStore.getState().server, () => runUndo("undo", { serverOnly: true }));
      }
    };
    const onMutation = (e: Event) => {
      const detail = (e as CustomEvent<MutationEventDetail>).detail;
      if (detail?.batch && detail.story) serverActed(detail.story, detail.batch);
      if (detail?.method === "DELETE") offerUndo.current = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
    const offChannel = changeChannel.subscribe(({ story, batch }) => {
      serverActed(story, batch);
      refreshServer();
    });
    const offScene = onSceneHistory(bumpVersion);
    const onFocus = () => void refreshServer();
    window.addEventListener(MUTATION_EVENT, onMutation);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(MUTATION_EVENT, onMutation);
      window.removeEventListener("focus", onFocus);
      offChannel();
      offScene();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const view = storyId ? undoView() : { canUndo: false, undoLabel: null, canRedo: false, redoLabel: null };
  return {
    ...view,
    busy,
    error,
    clearError: () => useUndoStore.setState({ error: null }),
    undo: () => runUndo("undo"),
    redo: () => runUndo("redo"),
  };
}

export type UndoRedoState = ReturnType<typeof useUndoRedo>;

/**
 * "Deleted character Margaret Holt · Undo", after a delete the log can take back. One undo
 * offer at a time (a page that offers its own, like a note's, wins), and the button declines
 * when something else has changed since: it would undo that instead.
 */
export function offerToUndo(storyId: string, state: UndoState, undo: () => void) {
  const label = state.undo_label;
  if (!state.can_undo || !label?.startsWith("Delete")) return;
  if (useToastStore.getState().toasts.some((t) => t.action)) return;
  toast.undoable(label.replace(/^Delete\b/, "Deleted"), async () => {
    const now = await toolsApi.undoState(storyId).catch(() => null);
    if (now?.undo_label !== label)
      return toast.info("Something has changed since. Undo from the header instead");
    undo();
  });
}
