import { describe, expect, it } from "vitest";
import { STORY_ROUTES } from "../lib/routes";
import { ROUTE_ELEMENTS } from "./routeElements";

describe("story routes", () => {
  it("has a page for every route in lib/routes.ts, and nothing else", () => {
    const ids = STORY_ROUTES.map((r) => r.id).sort();
    expect(Object.keys(ROUTE_ELEMENTS).sort()).toEqual(ids);
  });
});
