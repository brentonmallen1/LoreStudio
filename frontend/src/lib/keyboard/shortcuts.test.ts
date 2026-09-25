import { describe, expect, it } from "vitest";
import { SHORTCUTS, formatCombo, matchesCombo, yieldsToTyping, type ShortcutDef } from "./shortcuts";

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
  });

  it("formats combos for display", () => {
    const s = formatCombo("mod+shift+k");
    expect(s === "⌘⇧K" || s === "Ctrl+Shift+K").toBe(true);
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

  it("does not swallow a ⌘ combination: ⌘\\ is focus mode even in the editor", () => {
    expect(yieldsToTyping(typing({ key: "\\", metaKey: true }))).toBe(false);
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
