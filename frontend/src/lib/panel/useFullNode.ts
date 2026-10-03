import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import type { StructureNode } from "../../types";

// What was last read for each scene, so stepping back to one shows it at once while a
// fresh copy loads (the author may have changed it since).
const seen = new Map<string, StructureNode>();

/**
 * A scene with its prose and planning fields. The story tree carries neither, so the This
 * scene tab reads the scenes either side through this. Null while the first read is out.
 */
export function useFullNode(id: string | null | undefined): StructureNode | null {
  const [read, setRead] = useState<StructureNode | null>(null);
  const [version, setVersion] = useState(0);
  useReloadOnUndo(["structure_node"], () => setVersion((v) => v + 1));

  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .getNode(id)
      .then((full) => {
        seen.set(id, full);
        if (live) setRead(full);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, version]);

  if (!id) return null;
  return read?.id === id ? read : (seen.get(id) ?? null);
}
