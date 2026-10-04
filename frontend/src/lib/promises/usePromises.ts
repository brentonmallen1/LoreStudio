import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { Promises } from "../../types/promises";

/** Everything a promise touches: an undo of any of them redraws the view. */
export const PROMISE_ENTITIES = [
  "plot_thread",
  "plot_thread_appearance",
  "twist",
  "twist_clue",
  "reader_knowledge_event",
  "scene_link",
  "structure_node",
] as const;

const CHANGED = "lorestudio:promises-changed";

/** Say a promise changed outside the views that hold one (a clue planted from the prose). */
export function notifyPromisesChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * The story's promises (doc 18 C2), fetched once and again whenever a thread, twist, clue,
 * setup or reader entry changes here or through Undo. The store's threads changing (the
 * editor's chips, the Plan page) counts too.
 */
export function usePromises(storyId: string | undefined) {
  const [data, setData] = useState<Promises | null>(null);
  const threads = useStoryStore((s) => s.threads);
  const reload = useCallback(
    () => (storyId ? api.getPromises(storyId).then(setData, () => setData(null)) : Promise.resolve()),
    [storyId],
  );
  useEffect(() => {
    void reload();
  }, [reload, threads]);
  useReloadOnUndo(PROMISE_ENTITIES, reload);
  useEffect(() => {
    const on = () => void reload();
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, [reload]);
  return { data, reload };
}
