import { describe, expect, it } from "vitest";
import { STORY_REDIRECTS, STORY_ROUTES, fillParams, flatRoutes } from "../lib/routes";
import { ROUTE_ELEMENTS, SECTION_ELEMENTS } from "./routeElements";

describe("story routes", () => {
  it("has a page for every route without sections, and nothing else", () => {
    const ids = STORY_ROUTES.filter((r) => !r.sections)
      .map((r) => r.id)
      .sort();
    expect(Object.keys(ROUTE_ELEMENTS).sort()).toEqual(ids);
  });

  it("has a body for every section, and nothing else", () => {
    const keys = flatRoutes()
      .filter((e) => e.section)
      .map((e) => e.key)
      .sort();
    expect(Object.keys(SECTION_ELEMENTS).sort()).toEqual(keys);
  });

  it("gives every grouped page a first section at its own path", () => {
    for (const r of STORY_ROUTES.filter((r) => r.sections)) {
      expect(r.sections![0].path, r.id).toBe("");
      expect(new Set(r.sections!.map((s) => s.path)).size, r.id).toBe(r.sections!.length);
    }
  });

  it("redirects land on a real page or section, and no old path is still a route", () => {
    const paths = new Set(flatRoutes().map((e) => e.path));
    const detailPaths = new Set(
      flatRoutes()
        .filter((e) => e.section?.detailParam)
        .map((e) => `${e.path}/:${e.section!.detailParam}`),
    );
    for (const { from, to } of STORY_REDIRECTS) {
      expect(paths.has(to) || detailPaths.has(to), `${from} -> ${to}`).toBe(true);
      expect(paths.has(from), `${from} is still a route`).toBe(false);
    }
    expect(new Set(STORY_REDIRECTS.map((r) => r.from)).size).toBe(STORY_REDIRECTS.length);
  });

  it("fills a redirect's parameters", () => {
    expect(fillParams("/lorebook/characters/:characterId", { characterId: "c 1" })).toBe(
      "/lorebook/characters/c%201",
    );
  });
});
