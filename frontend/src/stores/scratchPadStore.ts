import { create } from "zustand";
import { freewriteApi } from "../api/freewrite";
import { scratchPadApi } from "../api/scratchPad";
import { dayLabel } from "../lib/freewrite/day";

const OLD_GLOBAL = "ls_scratchpad_global";
const OLD_STORY = /^ls_scratchpad_(.+)$/;

const hasWords = (html: string) => html.replace(/<[^>]*>/g, "").trim().length > 0;
const asText = (html: string) =>
  html
    .replace(/<\/(p|h\d|li)>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

/**
 * Bring a scratch pad kept in this browser before doc 15 N4 onto the account, once: the
 * shared pad becomes the account's pad (when that is still empty), and each story's own
 * pad goes to the end of that story's Freewrite page. The browser's copies are then cleared.
 */
async function adoptBrowserPads(serverHtml: string): Promise<string> {
  let html = serverHtml;
  try {
    const global = localStorage.getItem(OLD_GLOBAL) ?? "";
    if (hasWords(global) && !hasWords(html)) html = (await scratchPadApi.put(global)).html;
    if (global) localStorage.removeItem(OLD_GLOBAL);
    for (const key of Object.keys(localStorage)) {
      const m = OLD_STORY.exec(key);
      if (!m) continue;
      const text = asText(localStorage.getItem(key) ?? "");
      // A story that is gone (or not this account's) refuses; its pad is dropped with it.
      if (text) await freewriteApi.append(m[1], text, dayLabel(new Date())).catch(() => {});
      localStorage.removeItem(key);
    }
  } catch {
    // Site data blocked: nothing to bring over.
  }
  return html;
}

let loading: Promise<void> | null = null;

interface ScratchPadState {
  html: string;
  loaded: boolean;
  load: () => Promise<void>;
  /** Show at once; the drawer saves after a pause. */
  set: (html: string) => void;
  save: () => Promise<void>;
}

export const useScratchPadStore = create<ScratchPadState>((set, get) => ({
  html: "",
  loaded: false,
  // One load at a time: the header and the drawer both ask, and bringing the browser's pads
  // over twice would send a story's old pad to its Freewrite twice.
  load: () =>
    (loading ??= scratchPadApi
      .get()
      .then(({ html }) => adoptBrowserPads(html))
      .then((html) => set({ html, loaded: true }))
      .finally(() => {
        loading = null;
      })),
  set: (html) => set({ html }),
  save: async () => {
    await scratchPadApi.put(get().html);
  },
}));

export const scratchPadHasWords = (s: ScratchPadState) => hasWords(s.html);
export { asText as scratchText };
