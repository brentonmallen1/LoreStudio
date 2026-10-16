import { describe, expect, it } from "vitest";
import type { StoryStructureTemplate, StructureNode } from "../types";
import { landingPath, nextStep, plannedLine, styleOf } from "./workingStyle";

const node = (id: string, level: number, over: Partial<StructureNode> = {}, children: StructureNode[] = []) =>
  ({
    id,
    title: id,
    level,
    level_type: level === 1 ? "scene" : "chapter",
    status: "draft",
    word_count: 0,
    synopsis: "",
    position: 0,
    children,
    ...over,
  }) as StructureNode;

const template = { levels: [{ name: "Chapter" }, { name: "Scene" }], flat: false } as StoryStructureTemplate;

const story = [
  node("Ch 1", 0, {}, [
    node("The Light", 1, { word_count: 400, position: 0 }),
    node("Knock", 1, { word_count: 200, position: 1 }),
  ]),
  node("Ch 2", 0, { position: 1 }, [
    node("The Gap", 1, { status: "planned", synopsis: "Six months are missing.", position: 0 }),
    node("Low Water", 1, { status: "planned", position: 1 }),
  ]),
];

describe("where a new story opens", () => {
  it("opens a planner's story in the Outline", () => {
    expect(landingPath("s1", "plan", "n1")).toBe("/stories/s1/outline");
  });
  it("opens a discovery writer's story in its first scene", () => {
    expect(landingPath("s1", "discover", "n1")).toBe("/stories/s1/write?node=n1");
    expect(landingPath("s1", "discover", null)).toBe("/stories/s1/write");
  });
  it("opens anyone else's on the Overview", () => {
    expect(landingPath("s1", "both", "n1")).toBe("/stories/s1");
    expect(landingPath("s1", "", "n1")).toBe("/stories/s1");
  });
  it("puts the First story guide before all three", () => {
    expect(landingPath("s1", "plan", "n1", true)).toBe("/stories/s1/first-story");
  });
});

describe("the working style a story keeps", () => {
  it("reads the three ways and nothing else", () => {
    expect(styleOf({ working_style: "plan" })).toBe("plan");
    expect(styleOf({ working_style: "improvise" })).toBe("");
    expect(styleOf({})).toBe("");
    expect(styleOf(null)).toBe("");
  });
});

describe("the Overview's next step", () => {
  it("offers a planner the first planned scene with no words, and how many wait", () => {
    const step = nextStep(story, template, "plan");
    expect(step).toMatchObject({ kind: "write-planned", planned: 2 });
    expect(step?.scene.id).toBe("The Gap");
  });
  it("offers a discovery writer the scene they wrote in last", () => {
    expect(nextStep(story, template, "discover", "The Light")?.scene.id).toBe("The Light");
  });
  it("falls back to the last scene with words when the recent one is not a scene", () => {
    expect(nextStep(story, template, "discover", "elsewhere")).toMatchObject({
      kind: "keep-going",
      scene: { id: "Knock" },
    });
  });
  it("keeps the Overview as it was for a bit of both, or an older story", () => {
    expect(nextStep(story, template, "both", "The Light")).toBeNull();
    expect(nextStep(story, template, "", "The Light")).toBeNull();
  });
  it("has nothing to offer a planner whose every scene has words", () => {
    expect(nextStep([story[0]], template, "plan")).toBeNull();
  });
});

describe("the planned scene's line", () => {
  it("counts what waits and quotes the scene's summary", () => {
    expect(plannedLine(4, "The Gap", "Six months are missing.")).toBe(
      "Your Outline has 4 planned scenes with no words yet. “The Gap” is the first: Six months are missing.",
    );
    expect(plannedLine(1, "The Gap", "")).toBe("One planned scene in your Outline has no words yet.");
  });
});
