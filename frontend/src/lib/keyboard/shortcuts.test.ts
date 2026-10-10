import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  editorKey,
  formatCombo,
  matchesCombo,
  yieldsToTyping,
  type ShortcutDef,
} from "./shortcuts";

/**
 * Combos a browser keeps for itself: the page never sees the keydown, so a binding here can
 * never fire. Chrome's reserved commands (new window, incognito, tab, close, reopen, switch
 * tab, quit) plus Firefox's new private window, and ⌘\, which 1Password's extension (and
 * some browsers) take before the page sees it.
 */
const RESERVED = [
  "mod+n",
  "mod+shift+n",
  "mod+t",
  "mod+shift+t",
  "mod+w",
  "mod+shift+w",
  "mod+q",
  "mod+tab",
  "mod+shift+tab",
  "mod+pageup",
  "mod+pagedown",
  "mod+shift+p",
  "mod+\\",
];

describe("SHORTCUTS", () => {
  it("has no duplicate combos within overlapping scopes", () => {
    const seen = new Map<string, string>();
    for (const [id, def] of Object.entries(SHORTCUTS) as [string, ShortcutDef][]) {
      // global bindings clash with editor bindings too, since both can fire with the editor focused
      const key = def.combo;
      const prev = seen.get(key);
      expect(prev, `${id} and ${prev} both use ${key}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("uses no combo the browser keeps for itself", () => {
    for (const [id, def] of Object.entries(SHORTCUTS) as [string, ShortcutDef][]) {
      expect(RESERVED, `${id} uses ${def.combo}, which the browser takes first`).not.toContain(def.combo);
    }
  });

  it("matches an ⌥ combo by its physical key, since ⌥ changes the character on macOS", () => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? { metaKey: true, ctrlKey: false } : { ctrlKey: true, metaKey: false };
    const e = { ...mod, shiftKey: false, altKey: true, key: "µ", code: "KeyM" } as KeyboardEvent;
    expect(matchesCombo(e, "mod+alt+m")).toBe(true);
    expect(matchesCombo({ ...e, code: "KeyN" } as KeyboardEvent, "mod+alt+m")).toBe(false);
  });

  it("spells a combo the way TipTap's keymap does", () => {
    expect(editorKey("mod+alt+m")).toBe("Mod-Alt-m");
    expect(editorKey("mod+shift+i")).toBe("Mod-Shift-i");
  });

  it("matches combos against keyboard events", () => {
    const ev = (init: Partial<KeyboardEvent>) =>
      ({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: "", ...init }) as KeyboardEvent;
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? { metaKey: true } : { ctrlKey: true };
    expect(matchesCombo(ev({ ...mod, key: "k" }), "mod+k")).toBe(true);
    expect(matchesCombo(ev({ ...mod, key: "k", shiftKey: true }), "mod+k")).toBe(false);
    expect(matchesCombo(ev({ ...mod, key: "Z", shiftKey: true }), "mod+shift+z")).toBe(true);
    expect(matchesCombo(ev({ key: "?" }), "?")).toBe(true);
    expect(matchesCombo(ev({ key: "/" }), "?")).toBe(false);
    // The strip and the panel sit side by side: ⌥⌘, and ⌘. (⌘, alone is the browser's settings).
    // ⌥ changes the character on macOS (⌥, is "≤"), so the physical key matches too.
    expect(
      matchesCombo(ev({ ...mod, altKey: true, key: "≤", code: "Comma" }), SHORTCUTS.cycleStrip.combo),
    ).toBe(true);
    expect(matchesCombo(ev({ ...mod, key: "," }), SHORTCUTS.cycleStrip.combo)).toBe(false);
    expect(
      matchesCombo(ev({ ...mod, altKey: true, key: "†", code: "KeyT" }), SHORTCUTS.attributeDialogue.combo),
    ).toBe(true);
  });

  it("formats combos for display", () => {
    const s = formatCombo("mod+shift+k");
    expect(s === "⇧⌘K" || s === "Ctrl+Shift+K").toBe(true);
  });
});

describe("yieldsToTyping", () => {
  const typing = (init: Partial<KeyboardEvent>) => {
    const target = document.createElement("div");
    target.contentEditable = "true";
    Object.defineProperty(target, "isContentEditable", { value: true });
    return {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      key: "",
      target,
      ...init,
    } as unknown as KeyboardEvent;
  };

  it("lets a bare key through to the prose: ? is a question mark while writing", () => {
    expect(yieldsToTyping(typing({ key: "?" }))).toBe(true);
  });

  it("does not swallow a ⌘ combination: ⌥⌘F is focus mode even in the editor", () => {
    expect(yieldsToTyping(typing({ key: "ƒ", metaKey: true, altKey: true }))).toBe(false);
    expect(yieldsToTyping(typing({ key: "/", ctrlKey: true }))).toBe(false);
  });

  it("ignores typing state entirely outside a text field", () => {
    const ev = {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      key: "?",
      target: document.body,
    } as unknown as KeyboardEvent;
    expect(yieldsToTyping(ev)).toBe(false);
  });
});
