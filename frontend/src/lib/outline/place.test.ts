import { describe, expect, it } from "vitest";
import type { StoryStructureTemplate, StructureNode } from "../../types";
import { dropSpot, placeSpots } from "./place";
import { shapeOf } from "./tree";

const n = (id: string, over: Partial<StructureNode> = {}, children: StructureNode[] = []) =>
  ({ id, title: id, word_count: 0, position: 0, children, ...over }) as StructureNode;
const tpl = (...names: string[]) =>
  ({ levels: names.map((name) => ({ name, plural: `${name}s` })), flat: false }) as StoryStructureTemplate;
const acts = shapeOf(tpl("Act", "Chapter", "Scene"));

const tree = [
  n("Act 1", {}, [
    n("Storm Warning", {}, [n("The Light"), n("Knock", { position: 1 })]),
    n("The Stranger", { position: 1 }, []),
  ]),
];

describe("where an idea can be placed", () => {
  it("lists the start of each chapter and the spot after each of its scenes", () => {
    const spots = placeSpots(tree, acts);
    expect(spots.map((s) => [s.group, s.label, s.parentId, s.position])).toEqual([
      ["Storm Warning", "At the start", "Storm Warning", 0],
      ["Storm Warning", "After “The Light”", "Storm Warning", 1],
      ["Storm Warning", "After “Knock”", "Storm Warning", 2],
      ["The Stranger", "As its first scene", "The Stranger", 0],
    ]);
    expect(spots[0]).toMatchObject({ depth: 2, levelType: "scene" });
  });

  it("puts scenes at the top when the shape has one level", () => {
    const flat = shapeOf(tpl("Scene"));
    const spots = placeSpots([n("a"), n("b", { position: 1 })], flat);
    expect(spots.map((s) => [s.parentId, s.position, s.label])).toEqual([
      [null, 0, "At the start"],
      [null, 1, "After “a”"],
      [null, 2, "After “b”"],
    ]);
  });

  it("has nowhere to go in a story with no chapters yet", () => {
    expect(placeSpots([n("Act 1")], acts)).toEqual([]);
  });
});

describe("where a dropped idea lands", () => {
  it("goes above or below a scene among its siblings", () => {
    expect(dropSpot(tree, acts, "Knock", "above")).toMatchObject({ parentId: "Storm Warning", position: 1 });
    expect(dropSpot(tree, acts, "Knock", "below")).toMatchObject({ parentId: "Storm Warning", position: 2 });
  });

  it("goes at the end of a chapter dropped into", () => {
    expect(dropSpot(tree, acts, "The Stranger", "into")).toMatchObject({
      parentId: "The Stranger",
      position: 0,
    });
    expect(dropSpot(tree, acts, "Storm Warning", "into")).toMatchObject({ position: 2, label: "At the end" });
  });

  it("does not go into an act or beside a chapter", () => {
    expect(dropSpot(tree, acts, "Act 1", "into")).toBeNull();
    expect(dropSpot(tree, acts, "Storm Warning", "above")).toBeNull();
    expect(dropSpot(tree, acts, "missing", "above")).toBeNull();
  });
});
