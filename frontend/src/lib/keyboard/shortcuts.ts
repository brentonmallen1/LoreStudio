import type { UIMode } from "../mode";

/**
 * Single source of truth for keyboard shortcuts (refactor doc 04 §3, after IGAB).
 *
 * Every binding in the app reads its combo from here, the `?` overlay renders from here,
 * and `shortcuts.test.ts` fails if two entries in overlapping scopes share a combo.
 * Combos use `mod` for ⌘ on macOS / Ctrl elsewhere.
 */
export interface ShortcutDef {
  combo: string;
  label: string;
  group: "Global" | "Navigation" | "Editor" | "AI";
  /** Where the binding is active. "editor" bindings only fire with the prose editor focused. */
  scope: "global" | "editor";
  modes: UIMode[];
  /** Palette command that performs the same action, if any (checked by the coverage test). */
  commandId?: string;
}

const BOTH: UIMode[] = ["writer", "studio"];

export const SHORTCUTS = {
  palette: { combo: "mod+k", label: "Command palette", group: "Global", scope: "global", modes: BOTH },
  help: { combo: "?", label: "Keyboard shortcuts", group: "Global", scope: "global", modes: BOTH },
  undo: { combo: "mod+z", label: "Undo last change", group: "Global", scope: "global", modes: BOTH },
  redo: { combo: "mod+shift+z", label: "Redo", group: "Global", scope: "global", modes: BOTH },
  storySearch: {
    combo: "mod+shift+f",
    label: "Search the whole story",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "editor-story-search",
  },
  // ⌘[ and ⌘] are Back and Forward through the pages and scenes you have been on, as in a
  // browser, everywhere; stepping through the book's scenes in order is ⌥⌘↑ / ⌥⌘↓.
  back: {
    combo: "mod+[",
    label: "Back",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "nav-back",
  },
  forward: {
    combo: "mod+]",
    label: "Forward",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "nav-forward",
  },
  prevScene: {
    combo: "mod+alt+arrowup",
    label: "Previous scene",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "scene-previous",
  },
  nextScene: {
    combo: "mod+alt+arrowdown",
    label: "Next scene",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "scene-next",
  },
  // ⌥⌘F, Scrivener's key for its full-screen Composition mode. ⌘\ was taken before the page
  // saw it (1Password's extension, some browsers).
  focusMode: {
    combo: "mod+alt+f",
    label: "Toggle focus mode",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "view-focus",
  },
  cycleStrip: {
    // Beside ⌘. (the side panel): the strip on the left, the panel on the right. Not ⌘,
    // alone: every browser keeps that for its own settings.
    combo: "mod+alt+,",
    label: "Collapse or expand the story strip",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "strip-cycle-width",
  },
  scratchPad: {
    // Not ⌘⇧P: Firefox keeps that for a new private window and never shows it to the page.
    combo: "mod+alt+p",
    label: "Scratch pad",
    group: "Global",
    scope: "global",
    modes: BOTH,
    commandId: "scratch-pad",
  },
  toggleAIPanel: {
    combo: "mod+j",
    label: "Show or hide the assistant",
    group: "AI",
    scope: "global",
    modes: ["studio"],
    commandId: "toggle-ai-panel",
  },
  togglePanel: {
    combo: "mod+.",
    label: "Show or hide the side panel",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "panel-toggle",
  },
  floatAIPanel: {
    combo: "mod+shift+j",
    label: "Float or dock the side panel",
    group: "Global",
    scope: "global",
    modes: BOTH,
    commandId: "float-ai-panel",
  },
  assistant: {
    combo: "mod+/",
    label: "AI assistant panel",
    group: "AI",
    scope: "global",
    modes: ["studio"],
    commandId: "open-assistant",
  },
  find: { combo: "mod+f", label: "Find in scene", group: "Editor", scope: "editor", modes: BOTH },
  inlineNote: {
    // N for note. Not ⌘⇧N: Chrome keeps that for a new incognito window. Not ⇧⌥N alone:
    // without ⌘, ⌥ types a character into the prose.
    combo: "mod+alt+n",
    label: "Add a note",
    group: "Editor",
    scope: "editor",
    modes: BOTH,
  },
  nextNote: {
    combo: "mod+alt+]",
    label: "Next note in the scene",
    group: "Editor",
    scope: "editor",
    modes: BOTH,
    commandId: "editor-next-note",
  },
  prevNote: {
    combo: "mod+alt+[",
    label: "Previous note in the scene",
    group: "Editor",
    scope: "editor",
    modes: BOTH,
    commandId: "editor-prev-note",
  },
  attributeDialogue: {
    // T for tag. Not ⇧⌘D (browsers bookmark every tab) or ⌥⌘D (macOS shows the Dock).
    combo: "mod+alt+t",
    label: "Attribute selected dialogue",
    group: "Editor",
    scope: "editor",
    modes: BOTH,
  },
  submitText: {
    combo: "mod+enter",
    label: "Add what you've typed (ideas, answers)",
    group: "Global",
    scope: "global",
    modes: BOTH,
  },
  // No shortcut for Insert image (the editor's ⋯ menu) or the Writing coach (the selection
  // toolbar): ⇧⌘I and ⇧⌘R belong to browsers (developer tools, a hard reload), and so do
  // the ⌥⌘ forms.
} as const satisfies Record<string, ShortcutDef>;

export type ShortcutId = keyof typeof SHORTCUTS;

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** A click with ⌘ (Ctrl elsewhere) held: open it as a tab of its own beside the page. */
export function isModClick(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return IS_MAC ? e.metaKey : e.ctrlKey;
}

/** "⌘Click", or "Ctrl+Click": how a modified click is named in a tooltip. */
export function modClickLabel(): string {
  return formatCombo("mod+Click");
}

/** Does this keyboard event match the combo? `mod` means ⌘ on macOS and Ctrl elsewhere. */
export function matchesCombo(e: KeyboardEvent | React.KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;
  if (!wantMod && !wantShift && !wantAlt && key === "?") return e.key === "?";
  if (e.key.toLowerCase() === key) return true;
  // ⌥ changes the character on macOS (⌥M is "µ"), so match the physical key as well.
  return wantAlt && "code" in e && e.code === KEY_CODES[key];
}

const KEY_CODES: Record<string, string> = Object.fromEntries([
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => [c, `Key${c.toUpperCase()}`]),
  ..."0123456789".split("").map((d) => [d, `Digit${d}`]),
  [".", "Period"],
  [",", "Comma"],
  ["/", "Slash"],
  ["\\", "Backslash"],
  ["[", "BracketLeft"],
  ["]", "BracketRight"],
  ["arrowup", "ArrowUp"],
  ["arrowdown", "ArrowDown"],
]);

/** The same combo in TipTap's keymap spelling: "mod+alt+m" → "Mod-Alt-m". */
export function editorKey(combo: string): string {
  return combo
    .split("+")
    .map((p) => (p === "mod" ? "Mod" : p === "alt" ? "Alt" : p === "shift" ? "Shift" : p))
    .join("-");
}

/** "mod+shift+k" → "⇧⌘K" on macOS, "Ctrl+Shift+K" elsewhere. */
/**
 * Platform-correct modifier names for local interaction hints — "hold ⌥ to merge" in a
 * drag handler, say. Those are not app shortcuts and have no row in SHORTCUTS, but the
 * glyph still belongs in one place (D11).
 */
export const MODIFIER = {
  mod: IS_MAC ? "\u2318" : "Ctrl",
  alt: IS_MAC ? "\u2325" : "Alt",
  shift: IS_MAC ? "\u21e7" : "Shift",
} as const;

const ARROWS: Record<string, string> = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→" };

export function formatCombo(combo: string): string {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const shown =
    key === "enter"
      ? IS_MAC
        ? "↩"
        : "Enter"
      : (ARROWS[key] ?? (key.length === 1 ? key.toUpperCase() : key));
  // In the Mac's own order, as its menus spell them: ⌥, then ⇧, then ⌘ (⌥⌘F, ⇧⌘Z).
  if (IS_MAC) {
    return (
      (parts.includes("alt") ? "⌥" : "") +
      (parts.includes("shift") ? "⇧" : "") +
      (parts.includes("mod") ? "⌘" : "") +
      shown
    );
  }
  const mods = [
    parts.includes("mod") && "Ctrl",
    parts.includes("alt") && "Alt",
    parts.includes("shift") && "Shift",
  ].filter(Boolean);
  return [...mods, shown].join("+");
}

export function shortcutsFor(mode: UIMode): Array<ShortcutDef & { id: ShortcutId }> {
  return (Object.keys(SHORTCUTS) as ShortcutId[])
    .map((id) => ({ id, ...(SHORTCUTS[id] as ShortcutDef) }))
    .filter((s) => s.modes.includes(mode));
}

/** True when the event target is a text field or the prose editor (global bindings should yield). */
export function isTypingTarget(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
}

/**
 * Whether a global shortcut should stand aside for the author's typing.
 *
 * Only a bare key does: `?` in the editor is a question mark, not the help overlay. A
 * combination with ⌘/Ctrl or ⌥ types nothing, and skipping those too meant ⌥⌘F (focus
 * mode) and ⌘/ (the assistant) did nothing in the prose editor — the one place anyone
 * reaches for them.
 */
export function yieldsToTyping(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isTypingTarget(e) && !(e.metaKey || e.ctrlKey || e.altKey);
}
