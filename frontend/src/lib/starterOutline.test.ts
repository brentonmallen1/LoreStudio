import { describe, expect, it } from "vitest";
import { outlineHint, startsIn } from "./starterOutline";

/** Each built-in template as GET /structures describes it (backend seed STRUCTURE_TEMPLATES). */
function t(levels: string[], starter: string[], flat = false) {
  return { levels: levels.map((name) => ({ name, plural: `${name}s` })), starter_outline: starter, flat };
}

const TEMPLATES = {
  freeform: t(["Section", "Scene"], ["Section 1"]),
  "three-act": t(["Act", "Chapter", "Scene"], ["Act 1: Setup", "Act 2: Confrontation", "Act 3: Resolution"]),
  "seven-point": t(["Beat", "Scene"], ["Hook", "Plot Turn 1", "Midpoint", "Resolution"]),
  snowflake: t(["Part", "Chapter", "Scene"], ["Part 1"]),
  "heros-journey": t(["Stage", "Scene"], ["The Ordinary World", "The Call to Adventure"]),
  "mice-single": t(["Opening", "Try/Fail Beat", "Resolution"], ["Opening", "Try / Fail", "Resolution"], true),
  "mice-nested": t(["Movement", "Beat"], ["Movement 1"]),
  screenplay: t(["Act", "Scene"], ["Act One", "Act Two", "Act Three"]),
  "screenplay-sequences": t(["Act", "Sequence", "Scene"], ["Act One", "Act Two", "Act Three"]),
  "tv-half-hour": t(["Act", "Scene"], ["Cold Open", "Act One", "Act Two", "Tag"]),
  "tv-hour": t(["Act", "Scene"], ["Teaser", "Act One"]),
  "stage-play": t(["Act", "Scene"], ["Act One", "Act Two"]),
};

describe("where a new outline opens", () => {
  it.each([
    ["freeform", "a first scene in Section 1"],
    ["three-act", "a first scene in Act 1: Setup"],
    ["seven-point", "a first scene in Hook"],
    ["snowflake", "a first scene in Part 1"],
    ["heros-journey", "a first scene in The Ordinary World"],
    // The scaffold opens a flat template's first beat, not its last level.
    ["mice-single", "the opening"],
    ["mice-nested", "a first beat in Movement 1"],
    ["screenplay", "a first scene in Act One"],
    ["screenplay-sequences", "a first scene in Act One"],
    ["tv-half-hour", "a first scene in Cold Open"],
    ["tv-hour", "a first scene in Teaser"],
    ["stage-play", "a first scene in Act One"],
  ] as const)("%s opens %s", (id, expected) => {
    expect(startsIn(TEMPLATES[id])).toBe(expected);
  });

  it("opens the one node of a single-level template", () => {
    expect(startsIn(t(["Chapter"], ["Chapter 1"]))).toBe("Chapter 1");
  });

  it("says what is laid out and where writing starts", () => {
    expect(outlineHint(TEMPLATES["mice-single"])).toBe(
      "Opening · Try / Fail · Resolution, with the opening ready to write in. Rename, move or delete any of it.",
    );
    expect(outlineHint(TEMPLATES["mice-single"])).not.toContain("resolution ready");
  });
});
