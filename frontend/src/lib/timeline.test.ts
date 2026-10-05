import { describe, expect, it } from "vitest";
import type { Era, StructureNode } from "../types";
import { movedPositions, readingOrder, timelineRows } from "./timeline";

const scene = (id: string, position: number, extra: Partial<StructureNode> = {}) =>
  ({
    id,
    title: id,
    position,
    timeline_position: null,
    era_id: null,
    children: [],
    ...extra,
  }) as StructureNode;
const era = (id: string) => ({ id, name: id }) as Era;

describe("the timeline", () => {
  it("orders placed scenes by when they happen and marks a flashback", () => {
    const nodes = [
      scene("storm", 0, { timeline_position: 2, era_id: "keepers" }),
      scene("letter", 1, { timeline_position: 3, era_id: "keepers" }),
      scene("1962", 2, { timeline_position: 1, era_id: "war" }),
      scene("later", 3),
    ];
    const { placed, unplaced } = timelineRows(nodes, [era("keepers"), era("war")]);
    expect(placed.map((r) => r.node.id)).toEqual(["1962", "storm", "letter"]);
    expect(placed.map((r) => r.outOfOrder)).toEqual([true, false, false]);
    expect(placed.map((r) => r.eraStarts)).toEqual([true, true, false]);
    expect(placed[0].readingRank).toBe(3);
    expect(unplaced.map((r) => r.node.id)).toEqual(["later"]);
  });

  it("reads scenes inside chapters in reading order, and an era that is gone as none", () => {
    const chapter = scene("ch", 0, {
      children: [
        scene("b", 1, { timeline_position: 2 }),
        scene("a", 0, { timeline_position: 1, era_id: "gone" }),
      ],
    });
    const { placed } = timelineRows(readingOrder([chapter]), []);
    expect(placed.map((r) => [r.node.id, r.readingRank, r.outOfOrder, r.era])).toEqual([
      ["a", 1, false, null],
      ["b", 2, false, null],
    ]);
  });

  it("moves a scene and renumbers the rest", () => {
    const placed = [scene("a", 0), scene("b", 1), scene("c", 2)];
    expect([...movedPositions(placed, 2, 0)]).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
  });
});
