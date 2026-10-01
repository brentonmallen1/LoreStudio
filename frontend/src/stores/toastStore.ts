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
}

interface ToastState {
  toasts: Toast[];
  show: (text: string, tone?: ToastTone, ms?: number) => void;
  dismiss: (id: number) => void;
}

let next = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (text, tone = "info", ms = tone === "error" ? 6000 : 3500) => {
    const id = next++;
    // The same message twice in a row is one message, shown again.
    const repeat = get().toasts.find((t) => t.text === text && t.tone === tone);
    if (repeat) get().dismiss(repeat.id);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
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
};
