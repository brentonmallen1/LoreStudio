import { useSyncExternalStore } from "react";
import { PREFS_ADOPTED_EVENT, rememberPref } from "../preferences/accountPrefs";

/**
 * Which terms a writer has met (doc 30 D1). The first time a word is shown it carries a small
 * (?), so a new writer sees there is something to open; after that only its dotted underline.
 *
 * A term counts as met once it has been on screen in an earlier visit, or as soon as its
 * popover is opened. Within the visit a term is first shown in, its (?) stays, so it does not
 * vanish while the writer is still reading the page. Kept on the account (`rememberPref`),
 * so another device does not teach the same word twice.
 */
const KEY = "ls_terms_seen";

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    // Site data blocked or a damaged value: every term is new, which only costs a (?).
    return new Set();
  }
}

/** Met before this visit: no (?). */
let before = read();
/** Met at all, this visit included: what is kept. */
const kept = new Set(before);
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const fn of listeners) fn();
}

function save() {
  rememberPref(KEY, JSON.stringify([...kept].sort()));
}

if (typeof window !== "undefined") {
  window.addEventListener(PREFS_ADOPTED_EVENT, () => {
    // The account knew terms this browser did not: they are met already.
    for (const id of read()) {
      before.add(id);
      kept.add(id);
    }
    changed();
  });
}

/** Shown on screen: met from the next visit on. */
export function noteShown(id: string): void {
  if (kept.has(id)) return;
  kept.add(id);
  save();
}

/** Opened: met now, so its (?) goes at once. */
export function noteOpened(id: string): void {
  noteShown(id);
  if (before.has(id)) return;
  before.add(id);
  changed();
}

export function isNew(id: string): boolean {
  return !before.has(id);
}

/** Whether a term still wears its (?), re-read when one is opened. */
export function useIsNewTerm(id: string): boolean {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
  return isNew(id);
}

/** For tests: start a fresh visit from what is stored. */
export function resetSeenForTests(): void {
  before = read();
  kept.clear();
  for (const id of before) kept.add(id);
  changed();
}
