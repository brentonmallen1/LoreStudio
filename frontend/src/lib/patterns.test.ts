import { describe, expect, it } from "vitest";
import type { StructureNode } from "../types";
import { inPatternOrder, patternStanding, whereWords } from "./patterns";

const scene = (id: string, over: Partial<StructureNode> = {}) =>
  ({ id, title: id, word_count: 0, beat_id: null, ...over }) as StructureNode;

const sheet = {
  beats: [
    { id: "mid", name: "Midpoint", position_pct: 50, description: "" },
    { id: "open", name: "Opening image", position_pct: 1, description: "" },
    { id: "end", name: "Final image", position_pct: 99, description: "" },
  ],
};

describe("where a story stands against a pattern", () => {
  it("lists the moments in order, each with the scenes that carry it and how far through they sit", () => {
    const scenes = [
      scene("a", { beat_id: "open", word_count: 300 }),
      scene("b", { word_count: 200 }),
      scene("c", { beat_id: "mid" }),
      scene("d"),
    ];
    const { moments, written } = patternStanding(sheet, scenes);
    expect(moments.map((m) => [m.beat.id, m.carriers.map((c) => [c.node.id, c.at])])).toEqual([
      ["open", [["a", 12.5]]],
      ["mid", [["c", 62.5]]],
      ["end", []],
    ]);
    expect(written).toBe(50);
  });

  it("has nothing written and nothing carried in an empty story", () => {
    const { moments, written } = patternStanding(sheet, []);
    expect(written).toBe(0);
    expect(moments.every((m) => m.carriers.length === 0)).toBe(true);
  });
});

describe("a moment's place in words", () => {
  it("says roughly where it falls", () => {
    expect(whereWords(1)).toBe("At the very start");
    expect(whereWords(48)).toBe("About halfway through");
    expect(whereWords(75)).toBe("About three quarters of the way in");
    expect(whereWords(99)).toBe("At the very end");
  });
});

describe("the pickers' order", () => {
  it("puts the plain patterns first, simplest first, then the writer's own by name", () => {
    const sheets = [
      { id: "mine-b", name: "Zebra" },
      { id: "save-the-cat", name: "Save the Cat" },
      { id: "mine-a", name: "Apple" },
      { id: "three-act-beats", name: "Three turning points" },
    ];
    expect(inPatternOrder(sheets).map((s) => s.id)).toEqual([
      "three-act-beats",
      "save-the-cat",
      "mine-a",
      "mine-b",
    ]);
  });
});
