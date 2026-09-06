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
  focusMode: {
    combo: "mod+\\",
    label: "Toggle focus mode",
    group: "Navigation",
    scope: "global",
    modes: BOTH,
    commandId: "view-focus",
  },
  scratchPad: {
    combo: "mod+shift+p",
    label: "Scratch pad",
    group: "Global",
    scope: "global",
    modes: BOTH,
    commandId: "scratch-pad",
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
    combo: "mod+shift+n",
    label: "Add inline note",
    group: "Editor",
    scope: "editor",
    modes: BOTH,
  },
  attributeDialogue: {
    combo: "mod+shift+d",
    label: "Attribute selected dialogue",
    group: "Editor",
    scope: "editor",
    modes: BOTH,
  },
  insertImage: { combo: "mod+shift+i", label: "Insert image", group: "Editor", scope: "editor", modes: BOTH },
  writingCoach: {
    combo: "mod+shift+r",
    label: "Writing coach for selection",
    group: "AI",
    scope: "editor",
    modes: ["studio"],
  },
} as const satisfies Record<string, ShortcutDef>;

export type ShortcutId = keyof typeof SHORTCUTS;

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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
  return e.key.toLowerCase() === key;
}

/** "mod+shift+k" → "⌘⇧K" on macOS, "Ctrl+Shift+K" elsewhere. */
export function formatCombo(combo: string): string {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const shown = key.length === 1 ? key.toUpperCase() : key;
  if (IS_MAC) {
    return (
      (parts.includes("mod") ? "⌘" : "") +
      (parts.includes("alt") ? "⌥" : "") +
      (parts.includes("shift") ? "⇧" : "") +
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
