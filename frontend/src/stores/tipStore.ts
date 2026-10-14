import { create } from "zustand";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../lib/preferences/accountPrefs";
import { helper, type HelperId } from "../lib/typing/helpers";
import { useTypingStore } from "./typingStore";

/**
 * Tips while writing (doc 26, P4). Code that does something the long way offers the helper
 * that does it faster (`offerTip`); the status corner shows the offer at the next pause in
 * typing. On by default, with a switch in Settings › Writing (D2); at most two a session, only
 * for a helper not yet used, never the same one twice (D3). The first tip a writer ever sees
 * says how to turn them off. The switch and that first tip are kept with the account; the
 * session's count with the tab.
 */

const ON = "ls_tips";
const SEEN = "ls_tips_seen";
const SHOWN = "ls_tips_shown";
export const TIPS_A_SESSION = 2;

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readShown(): HelperId[] {
  try {
    return (sessionStorage.getItem(SHOWN) ?? "").split(",").filter(Boolean) as HelperId[];
  } catch {
    return [];
  }
}

function keepShown(shown: HelperId[]) {
  try {
    sessionStorage.setItem(SHOWN, shown.join(","));
  } catch {
    /* site data blocked: the count lasts as long as the page */
  }
}

export interface Tip {
  id: HelperId;
  /** The first tip this writer has seen: it says how to turn tips off. */
  first: boolean;
}

interface TipState {
  on: boolean;
  /** A tip has been shown to this writer before, on any device. */
  seen: boolean;
  /** This session's tips so far. */
  shown: HelperId[];
  /** Offered, waiting for a pause. */
  pending: HelperId | null;
  showing: Tip | null;
  offer: (id: HelperId) => void;
  /** At a pause in typing: the pending tip, if there is one. */
  pause: () => void;
  dismiss: () => void;
  setOn: (on: boolean) => void;
}

export const useTipStore = create<TipState>((set, get) => ({
  on: readPref(ON) !== "off",
  seen: readPref(SEEN) === "1",
  shown: readShown(),
  pending: null,
  showing: null,

  offer: (id) => {
    const { on, shown, showing } = get();
    if (!on || shown.length >= TIPS_A_SESSION || shown.includes(id) || showing?.id === id) return;
    if (useTypingStore.getState().used.has(id) || !helper(id).longWay) return;
    set({ pending: id });
  },

  pause: () => {
    const { pending, seen, shown, on } = get();
    if (!pending || !on) return;
    const next = [...shown, pending];
    keepShown(next);
    set({ pending: null, showing: { id: pending, first: !seen }, shown: next, seen: true });
    if (!seen) rememberPref(SEEN, "1");
  },

  dismiss: () => set({ showing: null }),

  setOn: (on) => {
    set(on ? { on } : { on, pending: null, showing: null });
    rememberPref(ON, on ? "on" : "off");
  },
}));

/** Something was done the long way: offer the helper that does it faster. */
export function offerTip(id: HelperId): void {
  useTipStore.getState().offer(id);
}

// A helper used drops its offer: the writer has found it.
useTypingStore.subscribe(({ used }) => {
  const { pending, showing } = useTipStore.getState();
  if (pending && used.has(pending)) useTipStore.setState({ pending: null });
  if (showing && used.has(showing.id)) useTipStore.setState({ showing: null });
});

if (typeof window !== "undefined") {
  window.addEventListener(PREFS_ADOPTED_EVENT, () =>
    useTipStore.setState({ on: readPref(ON) !== "off", seen: readPref(SEEN) === "1" }),
  );
}
