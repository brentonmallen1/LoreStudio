import { describe, expect, it } from "vitest";
import type { Character, Location, PlotThread, StoryStructureTemplate, StructureNode } from "../../types";
import type { SceneCast } from "../../types/panel";
import { buildLine, type ColourContext } from "../strip/stripModel";
import { buildTrail, parseStoryPath, type TrailInput } from "./trail";

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
    level_type: ["act", "chapter", "scene"][level] ?? "x",
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
  node("a1", "Act I", 0, {}, [
    node("c1", "Storm Warning", 1, {}, [node("s1", "The Light", 2, { status: "final" })]),
    node("c2", "The Stranger", 1, {}, [
      node("s2", "Knock at the Door", 2),
      node("s3", "Coming", 2, { status: "planned" }),
    ]),
  ]),
  node("a2", "Act II", 0),
];
const eleanor = { id: "e", name: "Eleanor Vance", color_slot: 1 } as Character;
const calder = { id: "v", name: "Calder", color_slot: 2 } as Character;
const cast: SceneCast = {
  scenes: [
    {
      node_id: "s1",
      character_ids: ["e"],
      location_ids: [],
      thread_ids: [],
      beat_id: null,
      status: "final",
      word_count: 1,
      opening: "",
    },
    {
      node_id: "s2",
      character_ids: ["v", "e"],
      location_ids: [],
      thread_ids: [],
      beat_id: null,
      status: "draft",
      word_count: 1,
      opening: "",
    },
  ],
};
const ctx: ColourContext = { characters: [eleanor, calder], threads: [], beatSheet: null, storyPov: "e" };

const input = (rest: string, over: Partial<TrailInput> = {}): TrailInput => ({
  storyId: "st",
  storyTitle: "The Last Lighthouse",
  rest,
  mode: "writer",
  aiAvailable: false,
  structure,
  line: buildLine(structure, template, null, cast),
  colourMode: "cast",
  ctx,
  characters: [eleanor, calder],
  locations: [{ id: "l1", name: "The Lighthouse", color_slot: 3 } as Location],
  threads: [{ id: "t1", name: "The Missing Logs", color_slot: 5 } as PlotThread],
  ...over,
});
const labels = (rest: string, over: Partial<TrailInput> = {}) =>
  buildTrail(input(rest, over)).map((c) => c.label);

describe("the address", () => {
  it("splits into page, section and entry", () => {
    const p = parseStoryPath("/lorebook/characters/e");
    expect([p.route?.id, p.section?.id, p.entryId]).toEqual(["lorebook", "characters", "e"]);
  });

  it("takes a sectioned page's own address as its first section", () => {
    const p = parseStoryPath("/promises");
    expect([p.route?.id, p.section?.id, p.entryId]).toEqual(["promises", "tapestry", null]);
  });

  it("knows no section that is not there", () => {
    expect(parseStoryPath("/lorebook/nowhere").section).toBeNull();
  });
});

describe("the trail", () => {
  it("is the book alone on the Overview, its › the pages with the Overview marked", () => {
    const [book, ...rest] = buildTrail(input(""));
    expect(rest).toEqual([]);
    expect(book).toMatchObject({ label: "The Last Lighthouse", to: "/stories/st" });
    expect(book.children.find((c) => c.current)?.label).toBe("Overview");
  });

  it("names the book, page, section and entry on a Lorebook sheet", () => {
    const trail = buildTrail(input("/lorebook/characters/e"));
    expect(trail.map((c) => c.label)).toEqual([
      "The Last Lighthouse",
      "Lorebook",
      "Characters",
      "Eleanor Vance",
    ]);
    expect(trail.map((c) => c.to)).toEqual([
      "/stories/st",
      "/stories/st/lorebook",
      "/stories/st/lorebook/characters",
      "/stories/st/lorebook/characters/e",
    ]);
    // The section's › is the cast, with their slot dots, the open one marked, the POV named.
    const characters = trail[2].children;
    expect(characters.map((c) => [c.label, c.current, c.hint])).toEqual([
      ["Eleanor Vance", true, "POV"],
      ["Calder", false, undefined],
    ]);
    expect(characters[0].mark).toEqual({ kind: "dot", color: "var(--cat-1)" });
    expect(trail[3].children).toEqual([]);
  });

  it("ends at a section whose last crumb lists what is in it (Promises › Threads ›)", () => {
    const trail = buildTrail(input("/promises/threads"));
    expect(trail.map((c) => c.label)).toEqual(["The Last Lighthouse", "Promises", "Threads"]);
    expect(trail[2].children.map((c) => c.label)).toEqual(["The Missing Logs"]);
    expect(trail[1].children.find((c) => c.current)?.label).toBe("Threads");
  });

  it("follows the outline while writing, each › its children with the next crumb marked", () => {
    const trail = buildTrail(input("/write/s2", { nodeId: "s2" }));
    expect(trail.map((c) => c.label)).toEqual([
      "The Last Lighthouse",
      "Act I",
      "The Stranger",
      "Knock at the Door",
    ]);
    expect(trail[1].children.filter((c) => !c.open).map((c) => [c.label, !!c.current])).toEqual([
      ["Storm Warning", false],
      ["The Stranger", true],
    ]);
    // The book's › starts with the book's top level, then the pages.
    expect(trail[0].children.slice(0, 2).map((c) => [c.label, c.group, !!c.current])).toEqual([
      ["Act I", "In the book", true],
      ["Act II", "In the book", false],
    ]);
    expect(trail[0].children.find((c) => c.group === "Pages" && c.current)?.label).toBe("Write");
    // A scene holds no nodes, only who is in it (the next test).
    expect(trail[3].children.every((c) => c.open)).toBe(true);
  });

  it("names who is in a node's scenes, most often first, to open beside the prose", () => {
    const trail = buildTrail(input("/write/s2", { nodeId: "s2" }));
    // The act: Eleanor is in two of its scenes, Calder in one.
    const act = trail[1].children;
    expect(act.filter((c) => !c.open).map((c) => c.group)).toEqual(["Chapters", "Chapters"]);
    expect(act.filter((c) => c.open).map((c) => [c.group, c.label, c.hint])).toEqual([
      ["Who is in it", "Eleanor Vance", "2 scenes"],
      ["Who is in it", "Calder", "1 scene"],
    ]);
    expect(act.find((c) => c.label === "Calder")?.open).toEqual({
      kind: "character",
      id: "v",
      name: "Calder",
    });
    expect(act.find((c) => c.label === "Calder")?.to).toBe("/stories/st/lorebook/characters/v");
    // The scene: in the prose's order, its point of view marked.
    expect(trail[3].children.map((c) => [c.label, c.hint])).toEqual([
      ["Calder", undefined],
      ["Eleanor Vance", "POV"],
    ]);
  });

  it("marks chapters with the strip's pips and scenes with their status shape", () => {
    const trail = buildTrail(input("/write/s2", { nodeId: "s2" }));
    expect(trail[2].mark).toEqual({ kind: "pips", colors: ["var(--cat-2)"] });
    expect(trail[3].mark).toEqual({ kind: "stop", shape: "hollow", color: "var(--cat-2)" });
    const scenes = trail[2].children.filter((c) => !c.open);
    expect(scenes.map((c) => c.mark)).toEqual([
      { kind: "stop", shape: "hollow", color: "var(--cat-2)" },
      { kind: "stop", shape: "dashed", color: undefined },
    ]);
    expect(trail[1].mark).toBeUndefined();
  });

  it("colours nothing in the plain mode but keeps the shapes", () => {
    const trail = buildTrail(input("/write/s1", { nodeId: "s1", colourMode: "none" }));
    expect(trail[2].mark).toBeUndefined();
    expect(trail[3].mark).toEqual({ kind: "stop", shape: "ringed", color: undefined });
  });

  it("lists a chapter's scenes when the chapter is the last crumb", () => {
    const trail = buildTrail(input("/write/c2", { nodeId: "c2" }));
    expect(
      trail
        .at(-1)
        ?.children.filter((c) => !c.open)
        .map((c) => c.label),
    ).toEqual(["Knock at the Door", "Coming"]);
  });

  it("keeps Studio pages out of Writer mode's menu", () => {
    const writer = buildTrail(input(""))
      .at(0)!
      .children.map((c) => c.label);
    const studio = buildTrail(input("", { mode: "studio", aiAvailable: true }))
      .at(0)!
      .children.map((c) => c.label);
    expect(writer).not.toContain("Publish");
    expect(studio).toContain("Publish");
  });

  it("drops an entry it cannot name, and a page it does not know", () => {
    expect(labels("/lorebook/characters/gone")).toEqual(["The Last Lighthouse", "Lorebook", "Characters"]);
    expect(labels("/elsewhere")).toEqual(["The Last Lighthouse"]);
  });
});
