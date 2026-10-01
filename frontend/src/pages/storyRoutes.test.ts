import { describe, expect, it } from "vitest";
import { STORY_ROUTES, flatRoutes } from "../lib/routes";
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
});
