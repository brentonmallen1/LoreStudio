import { describe, expect, it } from "vitest";
import { GUIDES } from "../guides";
import { flatRoutes, pageAbout, STORY_REDIRECTS } from "./routes";

/**
 * Every page says what it is for (doc 30 D2): a purpose line under its title and in its
 * logo-menu tooltip, and a guide behind its header's "How this page works". Add a page or a
 * section and this fails until it has both.
 */
describe("every page says what it is for", () => {
  const entries = flatRoutes();

  it("has a purpose line on every page and section", () => {
    const missing = entries.filter((e) => !pageAbout(e.route, e.section).purpose?.trim()).map((e) => e.key);
    expect(missing).toEqual([]);
  });

  it("keeps a purpose to one short line, in plain punctuation", () => {
    const long = entries
      .map((e) => [e.key, pageAbout(e.route, e.section).purpose ?? ""] as const)
      .filter(([, p]) => p.length > 80 || /—|\.$/.test(p))
      .map(([k]) => k);
    expect(long).toEqual([]);
  });

  it("names no AI in a line Writer mode shows", () => {
    const ai = /\b(AI|Assistant|Ollama|model|Codex)\b/;
    const loud = flatRoutes("writer")
      .filter((e) => !e.ai)
      .filter((e) => ai.test(pageAbout(e.route, e.section).purpose ?? ""))
      .map((e) => e.key);
    expect(loud).toEqual([]);
  });

  it("maps every page and section to a guide that exists in every mode the page has", () => {
    const bad = entries
      .filter((e) => {
        const guide = GUIDES.find((g) => g.id === pageAbout(e.route, e.section).guide);
        return !guide || e.modes.some((m) => !guide.modes.includes(m));
      })
      .map((e) => e.key);
    expect(bad).toEqual([]);
  });

  it("sends the old Proposals address to Discoveries", () => {
    expect(STORY_REDIRECTS["/proposals"]).toBe("/discoveries");
    expect(entries.find((e) => e.key === "proposals")?.path).toBe("/discoveries");
  });
});
