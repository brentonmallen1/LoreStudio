import { describe, expect, it } from "vitest";
import { sidesCollapsed, toggleSides } from "./sides";

describe("toggleSides", () => {
  it("collapses both sides and remembers how they were", () => {
    const { next, remember } = toggleSides({ strip: "scenes", panelOpen: true }, null);
    expect(next).toEqual({ strip: "strip", panelOpen: false });
    expect(remember).toEqual({ strip: "scenes", panelOpen: true });
    expect(sidesCollapsed(next)).toBe(true);
  });

  it("puts back what it remembered", () => {
    const { next, remember } = toggleSides(
      { strip: "strip", panelOpen: false },
      { strip: "scenes", panelOpen: false },
    );
    expect(next).toEqual({ strip: "scenes", panelOpen: false });
    expect(remember).toBeNull();
  });

  it("opens both sides when there is nothing to put back", () => {
    expect(toggleSides({ strip: "strip", panelOpen: false }, null).next).toEqual({
      strip: "chapters",
      panelOpen: true,
    });
  });

  it("collapses whatever is still open, even if one side already was", () => {
    expect(toggleSides({ strip: "strip", panelOpen: true }, null).next).toEqual({
      strip: "strip",
      panelOpen: false,
    });
  });
});
