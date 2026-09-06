import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { ApiError, MUTATION_EVENT } from "../api/request";
import { toolsApi, type UndoResult, type UndoState } from "../api/tools";
import { useStoryStore } from "../stores/storyStore";

/** Components that keep their own copy of story data listen for this and reload. */
export const UNDO_APPLIED_EVENT = "ls:undo-applied";

const EMPTY: UndoState = { can_undo: false, undo_label: null, can_redo: false, redo_label: null };

/**
 * Server-side undo/redo for the active story (refactor doc 05). The change log lives in the
 * backend; this hook shows its state and refreshes the stores after an undo or redo.
 * Prose keystrokes are handled by TipTap's own history and are not part of this.
 */
export function useUndoRedo() {
  const storyId = useStoryStore((s) => s.activeStory?.id ?? null);
  const [state, setState] = useState<UndoState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storyId) return setState(EMPTY);
    try {
      setState(await toolsApi.undoState(storyId));
    } catch {
      setState(EMPTY);
    }
  }, [storyId]);

  useEffect(() => {
    refresh();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onMutation = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
    window.addEventListener(MUTATION_EVENT, onMutation);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(MUTATION_EVENT, onMutation);
      window.removeEventListener("focus", refresh);
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  async function applyResult(result: UndoResult) {
    if (!storyId) return;
    const store = useStoryStore.getState();
    if (result.entity_type === "structure_node") {
      store.setStructure(await api.getStructure(storyId));
      const active = store.activeNode;
      if (active) {
        try {
          store.setActiveNode(await api.getNode(active.id));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) store.setActiveNode(null);
        }
      }
    } else if (result.entity_type === "character") {
      store.setCharacters(await api.listCharacters(storyId));
    }
    window.dispatchEvent(new CustomEvent(UNDO_APPLIED_EVENT, { detail: result }));
  }

  async function run(kind: "undo" | "redo") {
    if (!storyId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = kind === "undo" ? await toolsApi.undo(storyId) : await toolsApi.redo(storyId);
      await applyResult(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError(e.message);
      else if (!(e instanceof ApiError && e.status === 404)) setError(`Could not ${kind}`);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return {
    canUndo: state.can_undo,
    canRedo: state.can_redo,
    undoLabel: state.undo_label,
    redoLabel: state.redo_label,
    busy,
    error,
    clearError: () => setError(null),
    undo: () => run("undo"),
    redo: () => run("redo"),
  };
}

export type UndoRedoState = ReturnType<typeof useUndoRedo>;
