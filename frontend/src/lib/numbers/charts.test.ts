import { describe, expect, it } from "vitest";
import type { Character, PlotThread, StructureNode } from "../../types";
import type { Beat } from "../../types/beats";
import type { SceneCastEntry } from "../../types/panel";
import { beatMarks, castGrid, pacing, threadLanes } from "./charts";

const scene = (id: string, parent: string, words: number, extra: Partial<StructureNode> = {}) =>
  ({
    id,
    title: id.toUpperCase(),
    parent_id: parent,
    word_count: words,
    status: "draft",
    ...extra,
  }) as StructureNode;
const entry = (node_id: string, chars: string[], threads: string[] = [], words = 100): SceneCastEntry => ({
  node_id,
  character_ids: chars,
  location_ids: [],
  thread_ids: threads,
  beat_id: null,
  status: "draft",
  word_count: words,
  opening: "",
});

const scenes = [scene("a", "c1", 100), scene("b", "c1", 300), scene("c", "c2", 100), scene("d", "c2", 0)];
const cast = new Map([
  ["a", entry("a", ["el", "ma"], ["t1"], 100)],
  ["b", entry("b", ["el"], [], 300)],
  ["c", entry("c", ["el"], ["t1", "t2"], 100)],
  ["d", entry("d", [], [], 0)],
]);

describe("pacing", () => {
  it("gives each scene its words, its group and how far through the book it ends", () => {
    const bars = pacing(scenes, cast);
    expect(bars.map((b) => b.words)).toEqual([100, 300, 100, 0]);
    expect(bars.map((b) => b.group)).toEqual(["c1", "c1", "c2", "c2"]);
    expect(bars[1].through).toBeCloseTo(0.8);
    expect(bars[3].through).toBe(1);
  });

  it("places beats by their intended position and finds the scene that carries one", () => {
    const beats = [{ id: "mid", name: "Midpoint", position_pct: 50 }] as Beat[];
    const marks = beatMarks(beats, [scene("x", "c", 10, { beat_id: "mid" })]);
    expect(marks).toEqual([{ id: "mid", name: "Midpoint", at: 0.5, sceneId: "x" }]);
  });
});

describe("threadLanes", () => {
  it("lists the scenes each thread is in, earliest thread first", () => {
    const threads = [
      { id: "t2", name: "Late" },
      { id: "t1", name: "Early" },
      { id: "t3", name: "None" },
    ] as PlotThread[];
    const lanes = threadLanes(threads, scenes, cast);
    expect(lanes.map((l) => [l.thread.id, l.hits])).toEqual([
      ["t1", [0, 2]],
      ["t2", [2]],
      ["t3", []],
    ]);
  });
});

describe("castGrid", () => {
  const characters = [
    { id: "ma", name: "Margaret", arc_milestones: [{ id: "1", text: "", completed: true }] },
    { id: "el", name: "Eleanor", arc_milestones: [] },
  ] as unknown as Character[];

  it("ranks by scenes on the page and marks where each one is", () => {
    const rows = castGrid(characters, scenes, cast, 2);
    expect(rows[0].character.id).toBe("el");
    expect(rows[0].present).toEqual([true, true, true, false]);
    expect(rows[0]).toMatchObject({ count: 3, first: 0, last: 2, quiet: false });
  });

  it("calls someone quiet who has been absent from the last written scenes", () => {
    const margaret = castGrid(characters, scenes, cast, 2).find((r) => r.character.id === "ma")!;
    expect(margaret.quiet).toBe(true);
    expect(margaret.milestones).toEqual({ done: 1, total: 1 });
  });
});
