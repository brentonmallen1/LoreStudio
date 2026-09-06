import { describe, expect, it } from "vitest";
import "./index"; // registers every command
import { commandRegistry } from "./registry";
import { STORY_ROUTES } from "../routes";
import { SETTINGS_SECTIONS } from "../../pages/settings/sections";
import { SHORTCUTS, type ShortcutDef } from "../keyboard/shortcuts";

/**
 * "Everything from navigation to functionality is accessible in the command palette."
 * This test is how that stays true: add a route, a settings section or a shortcut and
 * it fails until the palette knows about it.
 */
describe("command palette coverage", () => {
  const ids = new Set(commandRegistry.getAll().map((a) => a.id));

  it("has a navigation command for every story route", () => {
    const missing = STORY_ROUTES.filter((r) => !ids.has(`nav-${r.id}`)).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it("has a command for every settings section", () => {
    const missing = SETTINGS_SECTIONS.filter((s) => !ids.has(`settings-${s.id}`)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it("every shortcut that names a command points at a registered one", () => {
    const missing = Object.entries(SHORTCUTS)
      .filter(([, def]) => (def as ShortcutDef).commandId && !ids.has((def as ShortcutDef).commandId!))
      .map(([id, def]) => `${id} -> ${(def as ShortcutDef).commandId}`);
    expect(missing).toEqual([]);
  });

  it("route and section ids are unique", () => {
    expect(new Set(STORY_ROUTES.map((r) => r.id)).size).toBe(STORY_ROUTES.length);
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(SETTINGS_SECTIONS.length);
  });
});
