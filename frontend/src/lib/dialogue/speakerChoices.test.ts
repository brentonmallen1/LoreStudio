import { describe, expect, it } from "vitest";
import type { Character } from "../../types";
import { speakerChoices } from "./speakerChoices";

const person = (id: string, name: string, aliases: string[] = []) =>
  ({ id, name, aliases, color_slot: 1 }) as unknown as Character;

const cast = [
  person("e", "Eleanor Vance", ["Nell"]),
  person("t", "Thomas Hale"),
  person("m", "Marguerite"),
  person("a", "Ada"),
  person("b", "bram"),
];
const names = (cs: Character[]) => cs.map((c) => c.id);

describe("speakerChoices", () => {
  it("puts the scene's people first: whose eyes, the scene's cast, then who already speaks", () => {
    const { inScene, rest } = speakerChoices(cast, {
      povId: "t",
      sceneCharacterIds: ["t", "e"],
      speakerNames: ["Marguerite", "Eleanor Vance"],
    });
    expect(names(inScene)).toEqual(["t", "e", "m"]);
    expect(names(rest)).toEqual(["a", "b"]);
  });

  it("finds a speaker by an alias, whatever the case", () => {
    const { inScene } = speakerChoices(cast, { speakerNames: [" nell ", "Nobody"] });
    expect(names(inScene)).toEqual(["e"]);
  });

  it("orders the rest of the cast by name, ignoring case", () => {
    const { inScene, rest } = speakerChoices(cast, {});
    expect(inScene).toEqual([]);
    expect(names(rest)).toEqual(["a", "b", "e", "m", "t"]);
  });

  it("ignores ids that are not in the cast", () => {
    const { inScene } = speakerChoices(cast, { povId: "gone", sceneCharacterIds: ["x", "a"] });
    expect(names(inScene)).toEqual(["a"]);
  });
});
