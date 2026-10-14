import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import type { Trope } from "../../types/tropes";

/** Everything a trope touches: an undo of any of them redraws the views that show tropes. */
export const TROPE_ENTITIES = [
  "trope",
  "trope_link",
  "structure_node",
  "character",
  "character_relationship",
  "plot_thread",
  "compendium_entry",
] as const;

const CHANGED = "lorestudio:tropes-changed";

/** Say a trope changed, so every view holding the story's tropes reads them again. */
export function notifyTropesChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

/** The story's tropes in play (doc 27), read again on any change here, elsewhere, or by Undo. */
export function useTropes(storyId: string | undefined) {
  const [tropes, setTropes] = useState<Trope[] | null>(null);
  const reload = useCallback(
    () => (storyId ? api.listTropes(storyId).then(setTropes, () => setTropes(null)) : Promise.resolve()),
    [storyId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useReloadOnUndo(TROPE_ENTITIES, reload);
  useEffect(() => {
    const on = () => void reload();
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, [reload]);
  return { tropes, reload };
}

/** Run a change, then tell every view; a failure is the caller's to report. */
export async function changeTropes<T>(p: Promise<T>): Promise<T> {
  const result = await p;
  notifyTropesChanged();
  return result;
}

/** The tropes that play at one place: a character (alone or in a relationship), or a scene. */
export function tropesAt(
  tropes: Trope[],
  where: { characterId?: string; relationshipIds?: string[]; nodeId?: string },
): Trope[] {
  const rels = new Set(where.relationshipIds ?? []);
  return tropes.filter((t) =>
    t.links.some(
      (lk) =>
        (where.characterId && lk.character_id === where.characterId) ||
        (lk.relationship_id && rels.has(lk.relationship_id)) ||
        (where.nodeId && lk.node_id === where.nodeId),
    ),
  );
}
