import { describe, expect, it } from "vitest";
import type { Era, StoryStructureTemplate, StructureNode } from "../../types";
import { timelineRows } from "../timeline";
import { cardColumns, timeColumns } from "./cards";
import { shapeOf } from "./tree";

const n = (id: string, over: Partial<StructureNode> = {}, children: StructureNode[] = []) =>
  ({
    id,
    title: id,
    word_count: 0,
    position: 0,
    timeline_position: null,
    children,
    ...over,
  }) as StructureNode;
const tpl = (...names: string[]) =>
  ({ levels: names.map((name) => ({ name, plural: `${name}s` })), flat: false }) as StoryStructureTemplate;

describe("the Cards, as the reader meets them", () => {
  it("has a column per chapter, its act named over the first", () => {
    const tree = [
      n("Act 1", {}, [
        n("Ch 1", {}, [n("a"), n("b", { position: 1 })]),
        n("Ch 2", { position: 1 }, [n("c")]),
      ]),
      n("Act 2", { position: 1 }, [n("Ch 3", {}, [])]),
    ];
    const cols = cardColumns(tree, shapeOf(tpl("Act", "Chapter", "Scene")));
    expect(cols.map((c) => [c.title, c.over, c.scenes.map((s) => s.id)])).toEqual([
      ["Ch 1", "Act 1", ["a", "b"]],
      ["Ch 2", undefined, ["c"]],
      ["Ch 3", "Act 2", []],
    ]);
  });

  it("has one column when the scenes sit at the top", () => {
    const flat = shapeOf({ ...tpl("Opening", "Try", "Resolution"), flat: true });
    const cols = cardColumns([n("o"), n("t", { position: 1 })], flat);
    expect(cols).toHaveLength(1);
    expect(cols[0].scenes.map((s) => s.id)).toEqual(["o", "t"]);
  });
});

describe("the Cards, as it happens", () => {
  it("runs the placed scenes by era, then the ones not on the timeline yet", () => {
    const eras = [{ id: "e1", name: "Five years earlier" }] as Era[];
    const leaves = [n("a", { timeline_position: 2 }), n("b", { timeline_position: 1, era_id: "e1" }), n("c")];
    const { placed, unplaced } = timelineRows(leaves, eras);
    const cols = timeColumns(placed, unplaced);
    expect(cols.map((c) => [c.title, c.placed, c.rows.map((r) => r.node.id)])).toEqual([
      ["Five years earlier", true, ["b"]],
      ["In the order it happens", true, ["a"]],
      ["Not on the timeline yet", false, ["c"]],
    ]);
  });

  it("says how to start when nothing is placed", () => {
    const cols = timeColumns([], []);
    expect(cols[0].hint).toMatch(/Place it next/);
  });
});
