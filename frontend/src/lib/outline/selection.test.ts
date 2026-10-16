import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import { canWrap, nextPartName, scenesBetween } from "./selection";
import { shapeOf, visibleRows } from "./tree";

const node = (id: string, children: StructureNode[] = [], words = 100) =>
  ({
    id,
    title: id,
    synopsis: "",
    word_count: children.length ? 0 : words,
    status: "draft",
    position: 0,
    children: children.map((c, i) => ({ ...c, position: i })),
  }) as unknown as StructureNode;

const THREE_ACT = shapeOf({
  levels: [
    { name: "Act", plural: "Acts" },
    { name: "Chapter", plural: "Chapters" },
    { name: "Scene", plural: "Scenes" },
  ],
  flat: false,
});

const tree = [
  { ...node("I", [node("C1", [node("a"), node("b"), node("c")]), node("C2", [node("d")])]), position: 0 },
];

describe("choosing scenes to wrap", () => {
  it("takes the scenes between two rows, skipping the parts", () => {
    const rows = visibleRows(tree, new Set(), THREE_ACT);
    expect(scenesBetween(rows, "b", "d")).toEqual(["b", "c", "d"]);
    expect(scenesBetween(rows, "c", "a")).toEqual(["a", "b", "c"]);
  });

  it("wraps scenes that sit together in one chapter, under the shape's own word", () => {
    expect(canWrap(tree, ["a", "b"], THREE_ACT)).toMatchObject({ ok: true, level: "chapter", count: 2 });
  });

  it("says why not, in the writer's words", () => {
    expect(canWrap(tree, ["a", "c"], THREE_ACT)).toMatchObject({
      refused: expect.stringMatching(/next to each other/),
    });
    expect(canWrap(tree, ["c", "d"], THREE_ACT)).toMatchObject({
      refused: expect.stringMatching(/one chapter/),
    });
    expect(canWrap(tree, ["a", "b", "c"], THREE_ACT)).toMatchObject({
      refused: "Those are every scene in “C1” already.",
    });
    const flat = shapeOf({ levels: [{ name: "Opening", plural: "Openings" }], flat: true });
    expect(canWrap(tree, ["a"], flat)).toMatchObject({ refused: expect.stringMatching(/side by side/) });
  });

  it("names the new part one more than the story has", () => {
    expect(nextPartName(tree, THREE_ACT)).toBe("Chapter 3");
  });
});
