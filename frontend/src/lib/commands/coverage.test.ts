import { describe, expect, it } from "vitest";
import "./index"; // registers every command
import { commandRegistry } from "./registry";
import { STORY_ROUTES } from "../routes";
import { useStoryStore } from "../../stores/storyStore";
import type { Story } from "../../types";
import { SETTINGS_SECTIONS } from "../../pages/settings/sections";
import { SHORTCUTS, type ShortcutDef } from "../keyboard/shortcuts";
import { GUIDES } from "../../guides";
import { getAllSessionTypes } from "../ai/sessionTypes";
import type { StructureNode } from "../../types";

/**
 * "Everything from navigation to functionality is accessible in the command palette."
 * This test is how that stays true: add a route, a settings section or a shortcut and
 * it fails until the palette knows about it.
 */
describe("command palette coverage", () => {
  const ids = new Set(commandRegistry.getAll().map((a) => a.id));

  it("reaches the Series page, which is not a story route, and starts a sequel", () => {
    expect([...ids].filter((id) => id.startsWith("series-")).sort()).toEqual([
      "series-canon",
      "series-new",
      "series-new-book",
      "series-open",
      "series-plan",
      "series-promises",
      "series-research",
      "series-story-so-far",
      "series-write-sequel",
    ]);
  });

  it("has a navigation command for every story route", () => {
    const missing = STORY_ROUTES.filter((r) => !ids.has(`nav-${r.id}`)).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it("has a navigation command for every section of a grouped page", () => {
    const missing = STORY_ROUTES.flatMap((r) =>
      (r.sections ?? [])
        .filter((s) => !(s.path === "" && s.label === r.label))
        .filter((s) => !ids.has(`nav-${r.id}-${s.id}`))
        .map((s) => `${r.id}.${s.id}`),
    );
    expect(missing).toEqual([]);
  });

  // Doc 12 D6: merging pages must not hide them. Each old page name (and the words people
  // reach for) still finds its new home among the first navigation results.
  it.each([
    ["characters", "nav-lorebook-characters"],
    ["personae", "nav-lorebook-characters"],
    ["cast", "nav-lorebook-characters"],
    ["world building", "nav-lorebook-places"],
    ["locations", "nav-lorebook-places"],
    ["plot threads", "nav-promises-threads"],
    ["twists", "nav-promises-twists"],
    ["foreshadowing", "nav-promises-setups"],
    ["dramatic irony", "nav-promises-reader"],
    ["thread map", "nav-promises-tapestry"],
    ["story identity", "nav-lorebook-identity"],
    ["media", "nav-compendium-images"],
    ["diagrams", "nav-compendium-diagrams"],
    ["versions", "nav-chronicle-versions"],
    ["snapshots", "nav-chronicle-versions"],
    ["story health", "nav-findings"],
    ["discoveries", "nav-proposals"],
    ["codex review", "nav-proposals"],
  ])("finds %s", (query, id) => {
    useStoryStore.setState({ activeStory: { id: "s1" } as Story });
    const nav = commandRegistry
      .search(query)
      .filter((a) => a.group === "Navigation")
      .slice(0, 3)
      .map((a) => a.id);
    expect(nav).toContain(id);
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

  it("has a command for every guide", () => {
    const missing = GUIDES.filter((g) => !ids.has(`guide-${g.id}`)).map((g) => g.id);
    expect(missing).toEqual([]);
  });

  it("has a command for every Assistant tool, all in the AI group Writer mode hides", () => {
    const missing = getAllSessionTypes()
      .filter((t) => t.id !== "assistant" && !ids.has(`ai-new-${t.id}`))
      .map((t) => t.id);
    expect(missing).toEqual([]);
    const notAI = commandRegistry
      .getAll()
      .filter((a) => a.id.startsWith("ai-new-") && a.group !== "AI")
      .map((a) => a.id);
    expect(notAI).toEqual([]);
  });

  it.each([
    ["coach", ["ai-new-writing-coach", "ai-new-cliche-coach"]],
    ["cliche", ["ai-new-cliche-coach"]],
    ["cliché", ["ai-new-cliche-coach"]],
    ["blurb", ["ai-new-book-description"]],
    ["logline", ["ai-new-story-identity-workshop"]],
  ])("finds the Assistant's tools by what they do: %s", (query, wanted) => {
    window.location.pathname = "/stories/s1"; // the setup file stubs location
    useStoryStore.setState({ activeStory: { id: "s1" } as Story, activeNode: { id: "n1" } as StructureNode });
    const found = commandRegistry
      .search(query)
      .slice(0, 5)
      .map((a) => a.id);
    for (const id of wanted) expect(found).toContain(id);
    window.location.pathname = "/";
  });

  it("offers no Assistant tool outside a story", () => {
    window.location.pathname = "/";
    expect(commandRegistry.search("coach").filter((a) => a.group === "AI")).toEqual([]);
  });

  it("route and section ids are unique", () => {
    expect(new Set(STORY_ROUTES.map((r) => r.id)).size).toBe(STORY_ROUTES.length);
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(SETTINGS_SECTIONS.length);
  });
});
