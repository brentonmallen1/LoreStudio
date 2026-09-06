import { describe, it, expect } from "vitest";
import { forceLayout, withinHops } from "./forceLayout";

describe("forceLayout", () => {
  it("places every node somewhere finite", () => {
    const positions = forceLayout(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [{ source: "a", target: "b" }],
      600,
      400,
    );
    expect(positions.size).toBe(3);
    for (const { x, y } of positions.values()) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("is empty for an empty graph", () => {
    expect(forceLayout([], [], 600, 400).size).toBe(0);
  });

  it("ignores an edge pointing at a node that was filtered out", () => {
    // Filtering by kind leaves dangling edges; d3-force throws on an unknown id.
    expect(forceLayout([{ id: "a" }], [{ source: "a", target: "gone" }], 600, 400).size).toBe(1);
  });
});

describe("withinHops", () => {
  const edges = [
    { source: "scene", target: "elena" },
    { source: "elena", target: "other-scene" },
    { source: "other-scene", target: "tomas" },
  ];
  const all = ["scene", "elena", "other-scene", "tomas", "loose"];

  it("returns everything when nothing is focused", () => {
    expect(withinHops("", edges, 1, all).size).toBe(5);
  });

  it("follows edges in either direction", () => {
    expect(withinHops("elena", edges, 1, all)).toEqual(new Set(["elena", "scene", "other-scene"]));
  });

  it("widens by one ring per hop", () => {
    expect(withinHops("scene", edges, 2, all)).toEqual(new Set(["scene", "elena", "other-scene"]));
    expect(withinHops("scene", edges, 3, all)).toEqual(new Set(["scene", "elena", "other-scene", "tomas"]));
  });

  it("leaves an unconnected node out", () => {
    expect(withinHops("scene", edges, 9, all).has("loose")).toBe(false);
  });
});
