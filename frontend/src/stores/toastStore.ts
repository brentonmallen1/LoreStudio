import { create } from "zustand";

/**
 * Short messages about something that just happened (doc 13 P6): "Snapshot created",
 * "That did not save". One place for them, so every page reports failures the same way,
 * each message keeps its own timer, and a screen reader hears them.
 */
export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
  /** One thing to do about it: "Undo". */
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  show: (text: string, tone?: ToastTone, ms?: number, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}

let next = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (text, tone = "info", ms = tone === "error" ? 6000 : 3500, action) => {
    const id = next++;
    // The same message twice in a row is one message, shown again.
    const repeat = get().toasts.find((t) => t.text === text && t.tone === tone);
    if (repeat) get().dismiss(repeat.id);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone, action }] }));
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), ms),
    );
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** For code outside React: `toast.error("The snapshot could not be deleted")`. */
export const toast = {
  info: (text: string) => useToastStore.getState().show(text, "info"),
  success: (text: string) => useToastStore.getState().show(text, "success"),
  error: (text: string) => useToastStore.getState().show(text, "error"),
  /** Something started or done, with somewhere to go: "Refreshing scene summaries · Open". */
  withAction: (text: string, label: string, run: () => void) =>
    useToastStore.getState().show(text, "info", 6000, { label, run }),
  /** Something done that can be taken back for a few seconds: "Note deleted · Undo". */
  undoable: (text: string, undo: () => void) =>
    useToastStore.getState().show(text, "info", 7000, { label: "Undo", run: undo }),
};
