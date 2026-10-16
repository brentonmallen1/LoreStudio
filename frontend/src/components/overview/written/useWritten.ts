import { useCallback, useEffect, useState } from "react";
import { writtenApi } from "../../../api/written";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import type { WrittenOut } from "../../../types/written";

/**
 * What you've written for one story (doc 29 D6), read again after anything that changes it is
 * undone: the scenes' lines, the cast and places, an answered name or a put-off offer.
 */
export function useWritten(storyId: string, enabled = true) {
  const [data, setData] = useState<WrittenOut | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(
    () =>
      writtenApi.get(storyId).then(
        (d) => {
          setData(d);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [storyId],
  );
  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);
  useReloadOnUndo(["structure_node", "character", "location", "proposal_decline"], () => enabled && load());
  return { data, failed, load };
}
