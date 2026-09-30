import { describe, expect, it } from "vitest";
import type { BeatSheet, Character, PlotThread, Story, StructureNode } from "../../types";
import {
  PLAN_METHODS,
  crossingThreads,
  methodById,
  nextStep,
  planMethods,
  sceneLeaves,
  stepProgress,
  type PlanData,
} from "./methods";

const story = (over: Partial<Story> = {}) =>
  ({ logline: "", premise: "", central_conflict: "", paragraph_summary: "", synopsis: "", ...over }) as Story;

const character = (over: Partial<Character> = {}) =>
  ({
    role: "protagonist",
    mission_statement: "",
    motivation: "",
    conflict: "",
    epiphany: "",
    arc_in_own_words: "",
    ...over,
  }) as Character;

const node = (over: Partial<StructureNode>): StructureNode =>
  ({ id: "x", level: 0, position: 0, word_count: 0, synopsis: "", children: [], ...over }) as StructureNode;

const THREE_LEVELS = { flat: false, levels: [{}, {}, {}] as { name: string; plural: string }[] };

describe("planning methods", () => {
  it("has unique method and step ids", () => {
    expect(new Set(PLAN_METHODS.map((m) => m.id)).size).toBe(PLAN_METHODS.length);
    for (const m of PLAN_METHODS) expect(new Set(m.steps.map((s) => s.id)).size).toBe(m.steps.length);
    expect(methodById("snowflake")?.label).toBe("Snowflake Method");
    expect(methodById("")).toBeUndefined();
  });

  it("walks the essentials in order, skipping what is written", () => {
    const essentials = methodById("essentials")!;
    const data: PlanData = { story: story(), characters: [], scenes: [] };
    expect(nextStep(essentials, data)?.id).toBe("logline");
    data.story = story({ logline: "A keeper hides a truth.", central_conflict: "Silence against truth." });
    expect(nextStep(essentials, data)?.id).toBe("characters");
  });

  it("counts main characters only, and every field of each", () => {
    const step = methodById("essentials")!.steps.find((s) => s.id === "characters")!;
    const full = { mission_statement: "a", motivation: "b", conflict: "c", epiphany: "d" };
    const data: PlanData = {
      story: story(),
      characters: [
        character(full),
        character({ ...full, epiphany: " " }),
        character({ role: "tertiary" }), // a walk-on is not asked about
      ],
      scenes: [],
    };
    expect(stepProgress(step, data)).toEqual({ done: 1, total: 2 });
  });

  it("needs at least one scene, each with a line saying what happens", () => {
    const step = methodById("snowflake")!.steps.at(-1)!;
    expect(stepProgress(step, { story: story(), characters: [], scenes: [] })).toEqual({ done: 0, total: 1 });
    const scenes = [node({ synopsis: "She lies." }), node({ synopsis: "" })];
    expect(stepProgress(step, { story: story(), characters: [], scenes })).toEqual({ done: 1, total: 2 });
  });

  it("lists scenes in reading order and skips empty acts", () => {
    const tree = [
      node({
        id: "act1",
        position: 0,
        children: [
          node({
            id: "ch1",
            level: 1,
            children: [node({ id: "b", level: 2, position: 1 }), node({ id: "a", level: 2, position: 0 })],
          }),
        ],
      }),
      node({ id: "act2", position: 1 }), // nothing in it yet
      node({ id: "prologue", position: 2, word_count: 300 }), // prose at the top level still counts
    ];
    expect(sceneLeaves(tree, THREE_LEVELS).map((n) => n.id)).toEqual(["a", "b", "prologue"]);
    expect(sceneLeaves(tree, { flat: true, levels: [] }).map((n) => n.id)).toEqual([
      "a",
      "b",
      "act2",
      "prologue",
    ]);
  });

  it("turns a beat sheet into a method whose beats ask which scene carries them", () => {
    const sheet = {
      id: "cat",
      name: "Save the Cat",
      description: "",
      beats: [
        { id: "mid", name: "Midpoint", position_pct: 50, description: "False victory." },
        { id: "open", name: "Opening Image", position_pct: 0, description: "" },
      ],
    } as BeatSheet;
    const method = methodById("beats:cat", [sheet])!;
    expect(method.steps.map((st) => st.id)).toEqual(["logline", "beat-open", "beat-mid"]);
    expect(method.steps[1].why).toBe("At the very start.");
    expect(planMethods([sheet]).length).toBe(PLAN_METHODS.length + 1);

    const beat = method.steps[2];
    const data: PlanData = {
      story: story(),
      characters: [],
      scenes: [node({ beat_id: "mid", synopsis: "" })],
    };
    expect(stepProgress(beat, data).done).toBe(0); // assigned, but nothing says what happens
    data.scenes = [node({ beat_id: "mid", synopsis: "She wins, wrongly." })];
    expect(stepProgress(beat, data).done).toBe(1);
  });

  it("counts MICE threads by kind and by where they open and close", () => {
    const [, threadsStep, , placement] = methodById("mice")!.steps;
    const thread = (over: Partial<PlotThread>) => ({ name: "t", mice_type: "idea", ...over }) as PlotThread;
    const data: PlanData = { story: story(), characters: [], scenes: [], threads: null };
    expect(stepProgress(threadsStep, data).done).toBe(0);
    data.threads = [thread({ opens_at_node_id: "a", closes_at_node_id: "b" }), thread({ mice_type: null })];
    expect(stepProgress(threadsStep, data)).toEqual({ done: 1, total: 1 });
    expect(stepProgress(placement, data)).toEqual({ done: 1, total: 1 });
  });

  it("finds threads that cross instead of nesting", () => {
    const scenes = ["s1", "s2", "s3", "s4"].map((id) => node({ id }));
    const t = (name: string, open: string, close: string) =>
      ({ name, mice_type: "event", opens_at_node_id: open, closes_at_node_id: close }) as PlotThread;
    expect(crossingThreads([t("outer", "s1", "s4"), t("inner", "s2", "s3")], scenes)).toEqual([]);
    expect(crossingThreads([t("A", "s1", "s3"), t("B", "s2", "s4")], scenes)).toEqual([["A", "B"]]);
  });
});
