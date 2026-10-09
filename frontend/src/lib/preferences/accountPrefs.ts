import { toolsApi } from "../../api/tools";
import { getToken } from "../../api/request";

/**
 * The author's choices follow their account (`user.settings.prefs`), so another browser,
 * another device, a new address for the server or cleared site data finds them as they were:
 * the theme and colour mode, the editor's type and line width, the interface size, dialogue
 * highlighting, the notes margin and the strip's colours.
 *
 * The browser keeps a copy under the same names, so the page draws right before the account
 * answers. When the two differ the account wins; an account with none yet learns this
 * browser's. How the windows are laid out (strip width, panel tabs) stays with the device.
 */
export const ACCOUNT_PREFS = [
  "ls_theme",
  "ls_color_mode",
  "ls_editor_font",
  "ls_editor_font_size",
  "ls_editor_line_width",
  "ls_ui_scale",
  "ls_highlight_dialogue",
  "ls_notes_margin",
  "ls_strip_colour",
] as const;

export type AccountPref = (typeof ACCOUNT_PREFS)[number];

/** Sent when the account's choices replace the browser's: stores re-read their copy. */
export const PREFS_ADOPTED_EVENT = "ls:prefs-adopted";

const UPLOAD_AFTER_MS = 800;
let timer: ReturnType<typeof setTimeout> | null = null;

function readLocal(): Partial<Record<AccountPref, string>> {
  const out: Partial<Record<AccountPref, string>> = {};
  for (const key of ACCOUNT_PREFS) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    } catch {
      /* site data blocked: nothing kept here to send */
    }
  }
  return out;
}

function upload() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (!getToken()) return;
    // The whole set each time: the account merges settings one level deep, so `prefs` is replaced.
    toolsApi.updateMe({ settings: { prefs: readLocal() } }).catch(() => {
      /* offline or signed out: the browser's copy holds it, and the next change sends it */
    });
  }, UPLOAD_AFTER_MS);
}

/** Keep a choice: in the browser at once, on the account a moment later (changes batch). */
export function rememberPref(key: AccountPref, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* site data blocked: the account still keeps it */
  }
  upload();
}

/**
 * On signing in and on every load: take the account's choices where they differ from the
 * browser's, or give the account this browser's when it has none yet. True when anything
 * in the browser changed.
 */
export function adoptAccountPrefs(settings: unknown): boolean {
  const saved = (settings as { prefs?: Record<string, unknown> } | undefined)?.prefs;
  if (!saved || Object.keys(saved).length === 0) {
    if (Object.keys(readLocal()).length > 0) upload();
    return false;
  }
  let changed = false;
  for (const key of ACCOUNT_PREFS) {
    const value = saved[key];
    if (typeof value !== "string") continue;
    try {
      if (localStorage.getItem(key) !== value) {
        localStorage.setItem(key, value);
        changed = true;
      }
    } catch {
      /* site data blocked: the stores keep what they have */
    }
  }
  if (changed) window.dispatchEvent(new Event(PREFS_ADOPTED_EVENT));
  return changed;
}
