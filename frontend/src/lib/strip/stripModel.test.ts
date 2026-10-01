import { describe, expect, it } from "vitest";
import type { BeatSheet, Character, PlotThread, StoryStructureTemplate, StructureNode } from "../../types";
import type { SceneCast } from "../../types/panel";
import {
  buildLine,
  colourFor,
  legendFor,
  nextWidth,
  roman,
  snapWidth,
  stepWidth,
  stopShape,
} from "./stripModel";

const node = (
  id: string,
  title: string,
  level: number,
  over: Partial<StructureNode> = {},
  children: StructureNode[] = [],
) =>
  ({
    id,
    title,
    level,
    level_type: "x",
    status: "draft",
    word_count: 100,
    children,
    ...over,
  }) as StructureNode;

const template = {
  levels: [{ name: "Act" }, { name: "Chapter" }, { name: "Scene" }],
  flat: false,
} as StoryStructureTemplate;
const structure = [
  node("a1", "Act 1", 0, {}, [
    node("c1", "Chapter 1", 1, {}, [node("s1", "The Light", 2, { status: "final", word_count: 200 })]),
    node("c2", "Chapter 2", 1, {}, [node("s2", "Knock", 2, { word_count: 300 })]),
  ]),
  node("a2", "Act 2", 0, {}, [
    node("c3", "Chapter 3", 1, {}, [
      node("s3", "Logbook", 2, { status: "revised" }),
      node("s4", "Gap", 2, { status: "planned", word_count: 0 }),
    ]),
  ]),
];

describe("buildLine", () => {
  it("groups stops into numbered stations and roman acts", () => {
    const line = buildLine(structure, template, "s2", null);
    expect(line.hasStations && line.hasActs).toBe(true);
    expect(line.stations.map((s) => [s.number, s.title, s.stops.length])).toEqual([
      [1, "Chapter 1", 1],
      [2, "Chapter 2", 1],
      [3, "Chapter 3", 2],
    ]);
    expect(line.acts.map((a) => [a.label, a.stations.length])).toEqual([
      ["I", 2],
      ["II", 1],
    ]);
    expect(line.currentIndex).toBe(1);
    expect(line.currentStationKey).toBe("c2");
    expect(line.currentActKey).toBe("a1");
  });

  it("reads out the chapter and how far through the words you are", () => {
    const line = buildLine(structure, template, "s2", null);
    expect(line.readout).toEqual({ top: "Ch 2", bottom: "of 3 · 33%" }); // 200 of 600 written
    expect(line.stations[0].done).toBe(1);
    expect(line.stations[2].done).toBe(0);
    expect(line.stations[2].planned).toBe(false);
  });

  it("puts the current chapter on a chapter page too", () => {
    const line = buildLine(structure, template, "c3", null);
    expect(line.currentIndex).toBe(-1);
    expect(line.currentStationKey).toBe("c3");
    expect(line.readout.top).toBe("Ch 3");
  });

  it("is a line of stops for a flat template", () => {
    const flat = { levels: [{ name: "Scene" }], flat: true } as StoryStructureTemplate;
    const line = buildLine([node("x", "One", 0), node("y", "Two", 0)], flat, "y", null);
    expect(line.hasStations).toBe(false);
    expect(line.stations).toHaveLength(1);
    expect(line.readout).toEqual({ top: "Sc 2", bottom: "of 2 · 50%" });
    expect(nextWidth("strip", false)).toBe("scenes");
    expect(nextWidth("strip", true)).toBe("chapters");
  });
});

describe("dragging and stepping the width", () => {
  it("snaps a drag to the nearest width", () => {
    expect(snapWidth(20, true)).toBe("strip");
    expect(snapWidth(150, true)).toBe("strip");
    expect(snapWidth(170, true)).toBe("chapters");
    expect(snapWidth(290, true)).toBe("scenes");
    expect(snapWidth(900, true)).toBe("scenes");
  });

  it("skips the chapter rows when there are no chapters", () => {
    expect(snapWidth(240, false)).toBe("scenes");
    expect(stepWidth("strip", false, 1)).toBe("scenes");
  });

  it("steps one width at a time and stops at the ends", () => {
    expect(stepWidth("strip", true, 1)).toBe("chapters");
    expect(stepWidth("scenes", true, 1)).toBe("scenes");
    expect(stepWidth("strip", true, -1)).toBe("strip");
  });
});

describe("colours and shapes", () => {
  const characters = [{ id: "e", name: "Eleanor", color_slot: 1 }] as Character[];
  const threads = [{ id: "t", name: "Logs", color_slot: 3 }] as PlotThread[];
  const beatSheet = {
    beats: [
      { id: "b1", name: "Opening Image" },
      { id: "b2", name: "Catalyst" },
    ],
  } as BeatSheet;
  const cast: SceneCast = {
    scenes: [
      {
        node_id: "s1",
        character_ids: ["e"],
        location_ids: [],
        thread_ids: ["t"],
        beat_id: null,
        status: "final",
        word_count: 200,
        opening: "",
      },
    ],
  };
  const ctx = { characters, threads, beatSheet };
  const line = buildLine(structure, template, "s1", cast);
  const s1 = line.stops[0];

  it("maps state to shape", () => {
    expect(["planned", "draft", "revised", "final"].map(stopShape)).toEqual([
      "dashed",
      "hollow",
      "filled",
      "ringed",
    ]);
  });

  it("colours a stop by who, threads, status or beat", () => {
    expect(colourFor("none", s1, ctx)).toEqual([]);
    expect(colourFor("cast", s1, ctx)).toEqual([{ color: "var(--cat-1)", label: "Eleanor" }]);
    expect(colourFor("threads", s1, ctx)).toEqual([{ color: "var(--cat-3)", label: "Logs" }]);
    expect(colourFor("status", s1, ctx)).toEqual([{ color: "var(--status-final)", label: "final" }]);
    const withBeat = { ...s1, node: { ...s1.node, beat_id: "b2" } };
    expect(colourFor("beat", withBeat, ctx)).toEqual([{ color: "var(--cat-2)", label: "Catalyst" }]);
    expect(colourFor("cast", line.stops[3], ctx)).toEqual([]); // planned stays dashed and bare
  });

  it("builds a key with each colour once", () => {
    expect(legendFor("threads", line.stops, ctx)).toEqual([{ color: "var(--cat-3)", label: "Logs" }]);
    expect(legendFor("status", line.stops, ctx).map((s) => s.label)).toEqual(["Draft", "Revised", "Final"]);
  });

  it("colours a stop by its findings, worst first, at most four", () => {
    const anchor = { node_id: "s1", character_id: null, location_id: null, thread_id: null, twist_id: null };
    const f = (id: string, severity: "high" | "mid" | "low") =>
      ({ id, severity, text: id, anchor }) as unknown as import("../../types/findings").Finding;
    const findings = [f("a", "low"), f("b", "high"), f("c", "mid"), f("d", "low"), f("e", "low")];
    const withFindings = { ...ctx, findings };
    expect(colourFor("findings", s1, withFindings).map((s) => s.color)).toEqual([
      "var(--color-danger)",
      "var(--color-warning)",
      "var(--color-text-subtle)",
      "var(--color-text-subtle)",
    ]);
    expect(colourFor("findings", line.stops[1], withFindings)).toEqual([]);
    expect(legendFor("findings", line.stops, withFindings).map((s) => s.label)).toEqual([
      "Look at these first",
      "Worth a look",
      "Small things",
    ]);
  });

  it("counts in roman", () => {
    expect([1, 4, 12, 13].map(roman)).toEqual(["I", "IV", "XII", "13"]);
  });
});
