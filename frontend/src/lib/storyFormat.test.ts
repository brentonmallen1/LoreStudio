import { describe, expect, it } from "vitest";
import type { StoryStructureTemplate } from "../types";
import {
  DEFAULT_TEMPLATE,
  formatOf,
  isScript,
  readingTime,
  runningTime,
  runningTimeRule,
  templatesFor,
} from "./storyFormat";

function template(id: string, format: "" | "screenplay"): StoryStructureTemplate {
  return {
    id,
    name: id,
    description: "",
    levels: [],
    is_system: true,
    user_id: null,
    starter_outline: [],
    flat: false,
    format,
  };
}

const ALL = [template("three-act", ""), template("screenplay", "screenplay"), template("freeform", "")];

describe("story format", () => {
  it("reads a story with no format as prose", () => {
    expect(formatOf(null)).toBe("prose");
    expect(formatOf({ story_format: "prose" })).toBe("prose");
    expect(isScript({ story_format: "screenplay" })).toBe(true);
    expect(isScript(undefined)).toBe(false);
  });

  it("offers a screenplay its own structures first, then the ones that fit any", () => {
    expect(templatesFor(ALL, "screenplay").map((t) => t.id)).toEqual(["screenplay", "three-act", "freeform"]);
  });

  it("keeps the screenplay structures out of a prose story", () => {
    expect(templatesFor(ALL, "prose").map((t) => t.id)).toEqual(["three-act", "freeform"]);
  });

  it("starts each format on a structure it offers", () => {
    for (const format of ["prose", "screenplay"] as const)
      expect(templatesFor(ALL, format).some((t) => t.id === DEFAULT_TEMPLATE[format])).toBe(true);
  });
});

/** A script runs about a minute a page (doc 25, P11). */
describe("running time", () => {
  it("says hours and minutes, on screen or on stage, and the minute a page it assumes", () => {
    expect(runningTime(1)).toBe("about a minute on screen, at a minute a page");
    expect(runningTime(52)).toBe("about 52 minutes on screen, at a minute a page");
    expect(runningTime(60, "stage_play")).toBe("about 1 hour on stage, at a minute a page");
    expect(runningTime(112)).toBe("about 1 hour 52 minutes on screen, at a minute a page");
    expect(runningTime(121)).toBe("about 2 hours 1 minute on screen, at a minute a page");
  });

  it("says what the rule leaves out, more loosely for a play", () => {
    expect(runningTimeRule("screenplay")).toMatch(/rule of thumb/);
    expect(runningTimeRule("stage_play")).toMatch(/rough guide for a play/);
  });
});

describe("reading time", () => {
  it("says the words a minute it assumes", () => {
    expect(readingTime(1000)).toBe("about 4 minutes to read, at 250 words a minute");
    expect(readingTime(65_000)).toBe("about 4 hours 20 minutes to read, at 250 words a minute");
  });
});
