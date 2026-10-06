import { describe, expect, it } from "vitest";
import { filterGroups, matches, type OpenGroup } from "./openChoices";

const groups: OpenGroup[] = [
  {
    name: "Characters",
    choices: [
      { type: "entity", kind: "character", id: "1", label: "Eleanor Vance" },
      { type: "entity", kind: "character", id: "2", label: "Thomas Reed" },
    ],
  },
  { name: "Places", choices: [{ type: "entity", kind: "location", id: "3", label: "Harrow Island" }] },
  { name: "Lists and tools", choices: [{ type: "tool", tool: "notes", label: "Notes" }] },
];

describe("+ Open… in the side panel", () => {
  it("matches every word typed, in any order, ignoring case and accents", () => {
    expect(matches("Eleanor Vance", "vance el")).toBe(true);
    expect(matches("Café Rouge", "cafe")).toBe(true);
    expect(matches("Thomas Reed", "tom")).toBe(false);
  });

  it("offers everything before anything is typed", () => {
    expect(filterGroups(groups, "  ").map((g) => g.choices.length)).toEqual([2, 1, 1]);
  });

  it("keeps only the groups with a match", () => {
    const found = filterGroups(groups, "harrow");
    expect(found.map((g) => g.name)).toEqual(["Places"]);
  });
});
