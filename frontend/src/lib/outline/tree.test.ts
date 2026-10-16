import { describe, expect, it } from "vitest";
import type { StoryStructureTemplate, StructureNode } from "../../types";
import {
  indent,
  isBlank,
  moveTo,
  nextSpot,
  outdent,
  outdentSpot,
  indentSpot,
  outlineSummary,
  partSummary,
  placeOf,
  rowBefore,
  shapeOf,
  visibleRows,
  type Move,
} from "./tree";

const n = (id: string, over: Partial<StructureNode> = {}, children: StructureNode[] = []) =>
  ({
    id,
    title: id,
    synopsis: "",
    word_count: 0,
    status: "planned",
    level: 0,
    level_type: "x",
    parent_id: null,
    position: 0,
    children: children.map((c, i) => ({ ...c, parent_id: id, position: i })),
    ...over,
  }) as StructureNode;

const tpl = (...names: string[]) =>
  ({ levels: names.map((name) => ({ name, plural: `${name}s` })), flat: false }) as StoryStructureTemplate;
const freeform = shapeOf(tpl("Section", "Scene"));
const threeAct = shapeOf(tpl("Act", "Chapter", "Scene"));

/** Section 1 holds a, b and c, all planned; Section 2 holds d, with words. */
const story = () => [
  n("S1", { position: 0, level_type: "section" }, [
    n("a", { level: 1, level_type: "scene" }),
    n("b", { level: 1, level_type: "scene" }),
    n("c", { level: 1, level_type: "scene" }),
  ]),
  n("S2", { position: 1, level_type: "section" }, [
    n("d", { level: 1, level_type: "scene", word_count: 120 }),
  ]),
];

const ok = (m: Move) => {
  if ("refused" in m) throw new Error(m.refused);
  return m;
};
const kids = (tree: StructureNode[], id: string | null) =>
  (id ? placeOf(tree, id)!.node.children : tree).map((c) => c.id);

describe("Shift+Tab: a line moves out a level", () => {
  it("makes a planned scene the section that holds the scenes after it", () => {
    const { tree, ops } = ok(outdent(story(), "b", freeform));
    expect(kids(tree, null)).toEqual(["S1", "b", "S2"]);
    expect(kids(tree, "S1")).toEqual(["a"]);
    expect(kids(tree, "b")).toEqual(["c"]);
    expect(placeOf(tree, "b")!.node).toMatchObject({ level: 0, level_type: "section" });
    expect(ops).toContainEqual({ node_id: "b", parent_id: null, position: 1, level_type: "section" });
    expect(ops).toContainEqual({ node_id: "c", parent_id: "b", position: 0 });
    // The server reads a parent's new level before its parts'.
    expect(ops.findIndex((o) => o.node_id === "b")).toBeLessThan(ops.findIndex((o) => o.node_id === "c"));
  });

  it("keeps a scene with words a scene: prose lives in scenes", () => {
    expect(outdent(story(), "d", freeform)).toEqual({ refused: expect.stringContaining("has words") });
  });

  it("leaves a part that holds parts of its own, and the top, where they are", () => {
    const three = [n("A1", {}, [n("C1", { level: 1 }, [n("s", { level: 2 })])])];
    expect(outdent(three, "C1", threeAct)).toEqual({ refused: expect.stringContaining("holds scenes") });
    expect(outdent(three, "A1", threeAct)).toEqual({
      refused: expect.stringContaining("already at the top"),
    });
  });
});

describe("Tab: a line tucks under the one above", () => {
  it("is Shift+Tab's way back", () => {
    const out = ok(outdent(story(), "b", freeform));
    const back = ok(indent(out.tree, "b", freeform));
    expect(kids(back.tree, null)).toEqual(["S1", "S2"]);
    expect(kids(back.tree, "S1")).toEqual(["a", "b", "c"]);
    expect(placeOf(back.tree, "b")!.node).toMatchObject({ level: 1, level_type: "scene" });
    expect(back.ops).toContainEqual({ node_id: "b", parent_id: "S1", position: 1, level_type: "scene" });
  });

  it("turns a chapter into a scene at the end of the one above, its scenes after it", () => {
    const tree = [
      n("A1", { level_type: "act" }, [
        n("C1", { level: 1, level_type: "chapter" }, [n("s1", { level: 2 })]),
        n("C2", { level: 1, level_type: "chapter" }, [n("s2", { level: 2 })]),
      ]),
    ];
    const { tree: next } = ok(indent(tree, "C2", threeAct));
    expect(kids(next, "A1")).toEqual(["C1"]);
    expect(kids(next, "C1")).toEqual(["s1", "C2", "s2"]);
    expect(placeOf(next, "C2")!.node.level_type).toBe("scene");
  });

  it("refuses a scene, the first line, a line above with words, and a flat shape", () => {
    expect(indent(story(), "b", freeform)).toEqual({ refused: expect.stringContaining("smallest part") });
    expect(indent(story(), "S1", freeform)).toEqual({ refused: expect.stringContaining("nothing above") });
    const held = [n("S1", { word_count: 50 }), n("S2")];
    expect(indent(held, "S2", freeform)).toEqual({ refused: expect.stringContaining("has words") });
    const flat = shapeOf({ ...tpl("Opening", "Try", "Resolution"), flat: true });
    expect(indent(story(), "S2", flat)).toEqual({ refused: expect.stringContaining("side by side") });
  });
});

describe("a drag", () => {
  it("moves a scene among scenes, into another section too", () => {
    const below = ok(moveTo(story(), "a", "d", "below", freeform));
    expect(kids(below.tree, "S1")).toEqual(["b", "c"]);
    expect(kids(below.tree, "S2")).toEqual(["d", "a"]);
    const into = ok(moveTo(story(), "d", "S1", "into", freeform));
    expect(kids(into.tree, "S1")).toEqual(["a", "b", "c", "d"]);
    expect(into.ops).toContainEqual({ node_id: "d", parent_id: "S1", position: 3 });
  });

  it("never changes a line's level", () => {
    expect(moveTo(story(), "a", "S2", "above", freeform)).toEqual({
      refused: expect.stringContaining("Tab"),
    });
    expect(moveTo(story(), "S2", "S1", "into", freeform)).toEqual({
      refused: expect.stringContaining("goes inside"),
    });
  });
});

describe("a new line", () => {
  it("goes first inside an open part, and next after anything else", () => {
    expect(nextSpot(story(), "S1", new Set(), freeform)).toEqual({ parentId: "S1", depth: 1, position: 0 });
    expect(nextSpot(story(), "S1", new Set(["S1"]), freeform)).toEqual({
      parentId: null,
      depth: 0,
      position: 1,
    });
    expect(nextSpot(story(), "b", new Set(), freeform)).toEqual({ parentId: "S1", depth: 1, position: 2 });
  });

  it("shows under the last line drawn before its place", () => {
    expect(rowBefore(story(), { parentId: null, depth: 0, position: 1 }, new Set())).toBe("c");
    expect(rowBefore(story(), { parentId: null, depth: 0, position: 1 }, new Set(["S1"]))).toBe("S1");
    expect(rowBefore(story(), { parentId: "S1", depth: 1, position: 0 }, new Set())).toBe("S1");
  });

  it("tucks in and moves out before it is saved", () => {
    expect(indentSpot(story(), { parentId: null, depth: 0, position: 1 }, freeform)).toEqual({
      parentId: "S1",
      depth: 1,
      position: 3,
    });
    expect(outdentSpot(story(), { parentId: "S1", depth: 1, position: 1 }, freeform)).toEqual({
      spot: { parentId: null, depth: 0, position: 1 },
      adopt: ["b", "c"],
    });
  });
});

describe("what the Outline says", () => {
  it("is blank until the writer has put something in it", () => {
    const fresh = [n("S1", {}, [n("s", { title: "Scene 1", level: 1 })])];
    expect(isBlank([], freeform)).toBe(true);
    expect(isBlank(fresh, freeform)).toBe(true);
    expect(isBlank([n("S1", {}, [n("s", { title: "The storm", level: 1 })])], freeform)).toBe(false);
    expect(isBlank(story(), freeform)).toBe(false);
  });

  it("counts the parts and the planned scenes", () => {
    expect(outlineSummary(story(), freeform)).toBe("2 sections · 4 scenes, 3 planned");
    expect(partSummary(story()[1], 0, freeform)).toBe("1 scene · 120 words");
  });

  it("hides what a folded part holds", () => {
    expect(visibleRows(story(), new Set(["S1"]), freeform).map((r) => r.node.id)).toEqual(["S1", "S2", "d"]);
  });
});
