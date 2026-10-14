import { describe, expect, it } from "vitest";
import type { Trope, TropeLink } from "../../types/tropes";
import { STANCES, TURNING, stanceLabel } from "./stances";
import { tropesAt } from "./useTropes";

const link = (over: Partial<TropeLink>): TropeLink => ({
  id: Math.random().toString(36),
  trope_id: "t",
  character_id: null,
  relationship_id: null,
  node_id: null,
  note: "",
  created_at: "",
  ...over,
});

const trope = (id: string, links: TropeLink[]): Trope => ({
  id,
  story_id: "s",
  name: id,
  stance: "undecided",
  why: "",
  thread_id: null,
  definition_id: null,
  position: 0,
  links,
  created_at: "",
  updated_at: "",
});

describe("stances", () => {
  it("names every stance and says which ones promise a turn", () => {
    expect(STANCES.map((s) => s.value)).toEqual([
      "undecided",
      "straight",
      "subverted",
      "inverted",
      "averted",
      "deconstructed",
      "lampshaded",
    ]);
    expect(stanceLabel("straight")).toBe("Played straight");
    expect([...TURNING].sort()).toEqual(["deconstructed", "inverted", "subverted"]);
  });
});

describe("tropesAt", () => {
  const badge = trope("badge", [link({ character_id: "newcomb" }), link({ node_id: "office" })]);
  const pair = trope("pair", [link({ relationship_id: "rel-1" })]);
  const story = trope("story", []);
  const all = [badge, pair, story];

  it("finds a character's tropes, alone and in their relationships", () => {
    expect(tropesAt(all, { characterId: "newcomb" })).toEqual([badge]);
    expect(tropesAt(all, { characterId: "richard", relationshipIds: ["rel-1"] })).toEqual([pair]);
  });

  it("finds a scene's tropes and leaves the whole-story ones out", () => {
    expect(tropesAt(all, { nodeId: "office" })).toEqual([badge]);
    expect(tropesAt(all, { nodeId: "elsewhere" })).toEqual([]);
  });
});
