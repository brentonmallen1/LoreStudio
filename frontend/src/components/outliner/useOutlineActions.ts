import { useCallback } from "react";
import { api } from "../../api/client";
import type { Move, ReorderOp } from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { StructureNode } from "../../types";

export interface NewLine {
  parentId: string | null;
  depth: number;
  position: number;
  levelType: string;
  title: string;
  synopsis?: string;
  scene: boolean;
}

/**
 * What the Outline asks of the server, each through the structure routes that record a
 * change, so ⌘Z takes it back (CLAUDE.md, Undo). A move shows at once and goes back if the
 * server refuses it.
 */
export function useOutlineActions(storyId: string) {
  const reload = useCallback(async () => {
    useStoryStore.getState().setStructure(await api.getStructure(storyId));
  }, [storyId]);

  /** A title or a line of what happens. */
  const save = useCallback(
    async (id: string, fields: Partial<Pick<StructureNode, "title" | "synopsis">>) => {
      const { patchNode, activeNode, setActiveNode } = useStoryStore.getState();
      patchNode(id, fields);
      if (activeNode?.id === id) setActiveNode({ ...activeNode, ...fields });
      try {
        await api.updateNode(id, fields);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That line could not be saved.");
        await reload().catch(() => {});
      }
    },
    [reload],
  );

  /** Tab, Shift+Tab or a drag, already worked out (`lib/outline/tree`). */
  const apply = useCallback(
    async (move: Extract<Move, { tree: StructureNode[] }>) => {
      if (!move.ops.length) return;
      const { structure, setStructure } = useStoryStore.getState();
      setStructure(move.tree);
      try {
        await api.reorderStructure(storyId, move.ops);
      } catch (err) {
        setStructure(structure);
        toast.error(err instanceof Error ? err.message : "That move could not be saved.");
      }
    },
    [storyId],
  );

  /** Reorder rows the tree already shows. */
  const reorder = useCallback(
    async (ops: ReorderOp[]) => {
      if (ops.length) await api.reorderStructure(storyId, ops);
      await reload();
    },
    [storyId, reload],
  );

  /** A new line in its place; a scene starts planned. Returns the new row. */
  const add = useCallback(
    async (line: NewLine): Promise<StructureNode | null> => {
      try {
        const node = await api.createNode(storyId, {
          parent_id: line.parentId,
          level: line.depth,
          level_type: line.levelType,
          title: line.title,
          synopsis: line.synopsis ?? "",
          position: line.position,
          status: line.scene ? "planned" : "draft",
          insert: true,
        });
        await reload();
        return node;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That line could not be added.");
        return null;
      }
    },
    [storyId, reload],
  );

  /** An empty line with nothing in it, taken away again. */
  const remove = useCallback(
    async (id: string) => {
      try {
        await api.deleteNode(id);
      } finally {
        await reload().catch(() => {});
      }
    },
    [reload],
  );

  return { save, apply, reorder, add, remove, reload };
}
