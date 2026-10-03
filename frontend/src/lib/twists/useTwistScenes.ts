import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";

/**
 * The scenes a twist touches: its reveal and the scenes its clues are planted in (doc 18). The
 * strip marks them when the twist's tab is open, as it does a character's or a thread's scenes;
 * its key promised the marks and none were drawn.
 */
export function useTwistScenes(storyId: string, twistId: string | null): Set<string> {
  const [scenes, setScenes] = useState<{ key: string; ids: Set<string> } | null>(null);
  const [version, setVersion] = useState(0);
  useReloadOnUndo(["twist"], () => setVersion((v) => v + 1));
  const key = `${storyId}:${twistId}:${version}`;
  useEffect(() => {
    if (!twistId) return;
    let live = true;
    api
      .listTwists(storyId)
      .then((all) => {
        const t = all.find((x) => x.id === twistId);
        const ids = new Set<string>();
        if (t?.revealed_at_node_id) ids.add(t.revealed_at_node_id);
        for (const c of t?.clues ?? []) if (c.node_id) ids.add(c.node_id);
        if (live) setScenes({ key, ids });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [storyId, twistId, key]);
  return twistId && scenes?.key === key ? scenes.ids : EMPTY;
}

const EMPTY = new Set<string>();
