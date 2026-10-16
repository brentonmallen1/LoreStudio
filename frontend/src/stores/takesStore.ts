import { create } from "zustand";
import type { SceneTake } from "../types/takes";

/**
 * The open scene's takes (doc 29 D7), shared by the editor (which take it shows, where autosave
 * writes), its header's switcher, Compare and the This scene tab. Empty while the scene has one
 * take: then the editor writes the scene's prose, as it always has.
 */
interface TakesState {
  /** The scene these are the takes of. */
  nodeId: string | null;
  takes: SceneTake[];
  /** Whether they have been read for `nodeId` yet. */
  loaded: boolean;
  /** Compare is showing in place of the editor. */
  comparing: boolean;
  setTakes: (nodeId: string, takes: SceneTake[]) => void;
  /** A take as autosave just saved it. */
  saved: (take: SceneTake) => void;
  reset: (nodeId: string | null) => void;
  setComparing: (comparing: boolean) => void;
}

export const useTakesStore = create<TakesState>((set, get) => ({
  nodeId: null,
  takes: [],
  loaded: false,
  comparing: false,
  setTakes: (nodeId, takes) =>
    set({ nodeId, takes, loaded: true, comparing: get().comparing && takes.length > 1 }),
  saved: (take) => {
    if (get().nodeId !== take.node_id) return;
    set({ takes: get().takes.map((t) => (t.id === take.id ? take : t)) });
  },
  reset: (nodeId) => set({ nodeId, takes: [], loaded: false, comparing: false }),
  setComparing: (comparing) => set({ comparing }),
}));

/** The take the editor shows for `nodeId`, or null when the scene has only its prose. */
export function openTake(nodeId: string | undefined): SceneTake | null {
  const { nodeId: id, takes } = useTakesStore.getState();
  return nodeId && id === nodeId ? (takes.find((t) => t.is_open) ?? null) : null;
}

/**
 * The take autosave writes to for `nodeId`: the open take when it is not the one that counts.
 * Null means the scene's own prose (the take that counts, or the only one).
 */
export function editingTake(nodeId: string | undefined): SceneTake | null {
  const open = openTake(nodeId);
  return open && !open.counts ? open : null;
}

/** "Take 2" or "Take 2 · Calder speaks first". */
export function takeName(take: Pick<SceneTake, "number" | "label">): string {
  return `Take ${take.number}${take.label ? ` · ${take.label}` : ""}`;
}
