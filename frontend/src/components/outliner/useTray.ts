import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { trayApi } from "../../api/tray";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import type { PlaceSpot } from "../../lib/outline/place";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { StructureNode, TrayItem } from "../../types";

export interface Tray {
  items: TrayItem[];
  loaded: boolean;
  add: (text: string) => Promise<void>;
  addMany: (items: { text: string; notes?: string }[]) => Promise<void>;
  rename: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Move an idea up or down the tray, or to an index. */
  move: (id: string, to: number) => Promise<void>;
  /** The idea becomes a planned scene at the spot and leaves the tray. */
  place: (id: string, spot: PlaceSpot) => Promise<StructureNode | null>;
}

const say = (err: unknown, fallback: string) => toast.error(err instanceof Error ? err.message : fallback);

/**
 * The Outline's Not placed yet tray (doc 29 D3): the story's ideas with no place yet, and
 * what can be done with them. Every change goes to the server, which records it for ⌘Z; an
 * undo anywhere reloads the tray.
 */
export function useTray(storyId: string): Tray {
  const [state, setState] = useState<{ of: string; items: TrayItem[] } | null>(null);
  const items = useMemo(() => (state?.of === storyId ? state.items : []), [state, storyId]);

  const load = useCallback(async () => {
    const next = await trayApi.list(storyId);
    setState({ of: storyId, items: next });
  }, [storyId]);

  useEffect(() => {
    let live = true;
    trayApi
      .list(storyId)
      .then((next) => live && setState({ of: storyId, items: next }))
      .catch(() => live && setState({ of: storyId, items: [] }));
    return () => {
      live = false;
    };
  }, [storyId]);
  useReloadOnUndo(["outline_item", "outline", "structure_node", "note"], load);

  const add = useCallback(
    async (text: string) => {
      try {
        await trayApi.add(storyId, text);
        await load();
      } catch (err) {
        say(err, "That idea could not be kept.");
      }
    },
    [storyId, load],
  );

  const addMany = useCallback(
    async (many: { text: string; notes?: string }[]) => {
      if (!many.length) return;
      try {
        await trayApi.addMany(storyId, many);
        await load();
      } catch (err) {
        say(err, "Those ideas could not be kept.");
      }
    },
    [storyId, load],
  );

  const rename = useCallback(
    async (id: string, text: string) => {
      setState((s) => s && { ...s, items: s.items.map((i) => (i.id === id ? { ...i, text } : i)) });
      try {
        await trayApi.edit(id, { text });
      } catch (err) {
        say(err, "That idea could not be saved.");
        await load().catch(() => {});
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setState((s) => s && { ...s, items: s.items.filter((i) => i.id !== id) });
      try {
        await trayApi.remove(id);
      } catch (err) {
        say(err, "That idea could not be deleted.");
        await load().catch(() => {});
      }
    },
    [load],
  );

  const move = useCallback(
    async (id: string, to: number) => {
      const from = items.findIndex((i) => i.id === id);
      if (from < 0 || to < 0 || to >= items.length || to === from) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setState({ of: storyId, items: next });
      try {
        await trayApi.reorder(
          storyId,
          next.map((i) => i.id),
        );
      } catch (err) {
        say(err, "The tray's order could not be saved.");
        await load().catch(() => {});
      }
    },
    [items, storyId, load],
  );

  const place = useCallback(
    async (id: string, spot: PlaceSpot) => {
      try {
        const node = await trayApi.place(id, {
          parent_id: spot.parentId,
          position: spot.position,
          level: spot.depth,
          level_type: spot.levelType,
        });
        useStoryStore.getState().setStructure(await api.getStructure(storyId));
        await load();
        return node;
      } catch (err) {
        say(err, "That idea could not be placed.");
        return null;
      }
    },
    [storyId, load],
  );

  return { items, loaded: state?.of === storyId, add, addMany, rename, remove, move, place };
}

/** The tray the Outline's List and Cards drop ideas from; absent beside the prose. */
export const TrayContext = createContext<Tray | null>(null);
export const useTrayContext = () => useContext(TrayContext);

/**
 * The idea being dragged out of the tray, if any. HTML drag and drop hides a drag's data
 * until the drop, and a row must know on dragover whether it can take what is coming.
 */
let dragging: TrayItem | null = null;
export const ideaDrag = {
  get: (): TrayItem | null => dragging,
  set: (item: TrayItem | null) => {
    dragging = item;
  },
};
