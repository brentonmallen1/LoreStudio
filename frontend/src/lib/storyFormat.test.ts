import { describe, expect, it } from "vitest";
import type { StoryStructureTemplate } from "../types";
import { DEFAULT_TEMPLATE, formatOf, isScript, templatesFor } from "./storyFormat";

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
