import { describe, expect, it } from "vitest";
import type { BeatSheet, Character, PlotThread, StoryStructureTemplate, StructureNode } from "../../types";
import type { SceneCast } from "../../types/panel";
import {
  buildLine,
  colourFor,
  COLLAPSED_PX,
  EXPANDED_MAX_PX,
  EXPANDED_MIN_PX,
  clampStripPx,
  legendFor,
  numberOf,
  roman,
  stopShape,
  stripPx,
  toggleStrip,
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
    expect(line.readout).toEqual({ position: 2, total: 3, unit: "chapter", pct: 33 }); // 200 of 600 written
    expect(line.stations[0].done).toBe(1);
    expect(line.stations[2].done).toBe(0);
    expect(line.stations[2].planned).toBe(false);
  });

  it("puts the current chapter on a chapter page too", () => {
    const line = buildLine(structure, template, "c3", null);
    expect(line.currentIndex).toBe(-1);
    expect(line.currentStationKey).toBe("c3");
    expect(line.readout.position).toBe(3);
  });

  // An imported draft: chapters holding prose beside chapters with scenes.
  const mixed = [
    node("a1", "Opening", 0, {}, [node("c0", "Fade In", 1)]),
    node("a2", "Act 1", 0, {}, [
      node("c1", "Chapter 1", 1, {}, [node("s1", "Lay of the Land", 2)]),
      node("c2", "Chapter 2", 1),
    ]),
    node("a3", "Coda", 0, {}, [node("c9", "Fade Out", 1)]),
  ];

  it("gives each act one numeral, and a chapter holding prose is its own station", () => {
    const line = buildLine(mixed, template, "s1", null);
    expect(line.acts.map((a) => [a.label, a.node?.id])).toEqual([
      ["I", "a1"],
      ["II", "a2"],
      ["III", "a3"],
    ]);
    expect(line.stations.map((s) => [s.number, s.node?.id])).toEqual([
      [1, "c0"],
      [2, "c1"],
      [3, "c2"],
      [4, "c9"],
    ]);
    const keys = [...line.acts, ...line.stations].map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("leaves a scene straight under an act unnumbered", () => {
    const loose = [
      node("a1", "Act 1", 0, {}, [
        node("s0", "Prologue", 2),
        node("c1", "Chapter 1", 1, {}, [node("s1", "A", 2)]),
      ]),
      node("a2", "Act 2", 0, {}, [node("c2", "Chapter 2", 1, {}, [node("s2", "B", 2)])]),
    ];
    const line = buildLine(loose, template, "s2", null);
    expect(line.stations.map((s) => [s.number, s.node?.id ?? null])).toEqual([
      [0, null],
      [1, "c1"],
      [2, "c2"],
    ]);
    expect(line.acts.map((a) => [a.label, a.stations.length])).toEqual([
      ["I", 2],
      ["II", 1],
    ]);
    expect(line.readout).toMatchObject({ position: 2, total: 2, unit: "chapter" });
  });

  it("has stations and no acts in two levels", () => {
    const two = { levels: [{ name: "Chapter" }, { name: "Scene" }], flat: false } as StoryStructureTemplate;
    const line = buildLine(
      [node("c1", "One", 0, {}, [node("s1", "A", 1)]), node("c2", "Two", 0)],
      two,
      null,
      null,
    );
    expect(line.hasActs).toBe(false);
    expect(line.stations.map((s) => [s.number, s.node?.id])).toEqual([
      [1, "c1"],
      [2, "c2"],
    ]);
  });

  it("names any act or chapter by its number in the book", () => {
    const line = buildLine(mixed, template, null, null);
    expect(numberOf(line, "a2")).toEqual({ kind: "act", label: "II", total: 3 });
    expect(numberOf(line, "c2")).toEqual({ kind: "chapter", label: "3", total: 4 });
    expect(numberOf(line, "s1")).toBeNull();
  });

  it("is a line of stops for a flat template", () => {
    const flat = { levels: [{ name: "Scene" }], flat: true } as StoryStructureTemplate;
    const line = buildLine([node("x", "One", 0), node("y", "Two", 0)], flat, "y", null);
    expect(line.hasStations).toBe(false);
    expect(line.stations).toHaveLength(1);
    expect(line.readout).toEqual({ position: 2, total: 2, unit: "scene", pct: 50 });
  });
});

describe("collapsed or expanded", () => {
  it("collapses to the line and expands to the outline", () => {
    expect(toggleStrip("scenes")).toBe("strip");
    expect(toggleStrip("strip")).toBe("scenes");
  });

  it("keeps the expanded width the author set, within its limits", () => {
    expect(stripPx("scenes", 340)).toBe(340);
    expect(stripPx("strip", 340)).toBe(COLLAPSED_PX);
    expect(clampStripPx(10)).toBe(EXPANDED_MIN_PX);
    expect(clampStripPx(9999)).toBe(EXPANDED_MAX_PX);
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

  it("colours a stop by whose eyes it is seen through, a planned scene too", () => {
    const eleanor = characters[0];
    const planned = line.stops[3];
    expect(colourFor("pov", planned, { ...ctx, storyPov: eleanor.id })).toEqual([
      { color: "var(--cat-1)", label: "Eleanor" },
    ]);
    expect(colourFor("pov", planned, ctx)).toEqual([]);
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
