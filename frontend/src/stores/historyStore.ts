import { create } from "zustand";

export interface HistoryEntry {
  description: string;
  undo: () => void | Promise<void>;
  redo?: () => void | Promise<void>;
}

interface HistoryStore {
  stack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  push: (entry: HistoryEntry) => void;
  pop: () => HistoryEntry | undefined;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  stack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  push: (entry) =>
    set((s) => ({
      stack: [...s.stack.slice(-49), entry],
      redoStack: [],
      canUndo: true,
      canRedo: false,
    })),

  pop: () => {
    const { stack } = get();
    if (stack.length === 0) return undefined;
    const last = stack[stack.length - 1];
    set((s) => ({
      stack: s.stack.slice(0, -1),
      redoStack: last.redo ? [...s.redoStack, last] : s.redoStack,
      canUndo: s.stack.length > 1,
      canRedo: !!last.redo || s.redoStack.length > 0,
    }));
    return last;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    set((s) => ({
      stack: [...s.stack, entry],
      redoStack: s.redoStack.slice(0, -1),
      canUndo: true,
      canRedo: s.redoStack.length > 1,
    }));
    entry.redo?.();
  },

  clear: () => set({ stack: [], redoStack: [], canUndo: false, canRedo: false }),
}));
