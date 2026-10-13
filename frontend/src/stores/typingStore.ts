import { create } from "zustand";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../lib/preferences/accountPrefs";
import { HELPERS, type HelperId } from "../lib/typing/helpers";

/**
 * The typing helpers the writer has used (doc 26, D1). Each helper reports itself the first
 * time it does its work; the set is kept with the account, so the Typing guide's ticks, the
 * tips and the lessons know it on every device. Only ids in the list are kept, so a helper
 * taken out of `HELPERS` drops out of the set.
 */

const KEY = "ls_typing_used";
const KNOWN = new Set<string>(HELPERS.map((h) => h.id));

function read(): Set<HelperId> {
  try {
    const raw = localStorage.getItem(KEY) ?? "";
    return new Set(raw.split(",").filter((id): id is HelperId => KNOWN.has(id)));
  } catch {
    return new Set();
  }
}

interface TypingState {
  used: Set<HelperId>;
  markUsed: (id: HelperId) => void;
}

export const useTypingStore = create<TypingState>((set, get) => ({
  used: read(),
  markUsed: (id) => {
    if (get().used.has(id)) return;
    const used = new Set(get().used).add(id);
    set({ used });
    rememberPref(KEY, [...used].sort().join(","));
  },
}));

/** A helper did its work: from an editor extension or a hook, outside React. */
export function markUsed(id: HelperId): void {
  useTypingStore.getState().markUsed(id);
}

if (typeof window !== "undefined") {
  window.addEventListener(PREFS_ADOPTED_EVENT, () => useTypingStore.setState({ used: read() }));
}
