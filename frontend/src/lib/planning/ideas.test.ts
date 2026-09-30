import { describe, expect, it } from "vitest";
import { splitIntoFragments, suggestNames } from "./ideas";

describe("the brain dump", () => {
  it("splits a paste into paragraphs, or lines when there are none", () => {
    expect(splitIntoFragments("A keeper.\nShe hides things.\n\nA storm comes.")).toEqual([
      "A keeper.\nShe hides things.",
      "A storm comes.",
    ]);
    expect(splitIntoFragments("- the keeper\n* the storm\n1. the stranger\n\n")).toEqual([
      "the keeper",
      "the storm",
      "the stranger",
    ]);
    expect(splitIntoFragments("   ")).toEqual([]);
  });

  it("suggests names the story does not know yet", () => {
    const text =
      "Calder arrives in the storm. Eleanor won't let her in. Maybe Calder knew Thomas at the Grey Tower.";
    expect(suggestNames(text, ["Eleanor Vance"])).toEqual(["Calder", "Thomas", "Grey Tower"]);
  });

  it("leaves out words that are only capitalised to start a sentence", () => {
    expect(suggestNames("Storms come in autumn. Nobody stays.", [])).toEqual([]);
    expect(suggestNames("I think she lies. She does.", [])).toEqual([]);
  });
});
