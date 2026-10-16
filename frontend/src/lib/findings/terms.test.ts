import { describe, expect, it } from "vitest";
import { glossaryEntry } from "../glossary";
import { roleTerm } from "../glossary/roles";
import { FINDING_TERMS, findingTerm } from "./terms";

describe("a finding's glossary word", () => {
  it("splits the line around the first match", () => {
    expect(findingTerm("passive_voice", "Passive voice in 3 sentences")).toEqual({
      id: "passive-voice",
      parts: ["", "Passive voice", " in 3 sentences"],
    });
    expect(findingTerm("tense_shift", "Slips out of past tense twice")?.parts).toEqual([
      "",
      "Slips out of past tense",
      " twice",
    ]);
  });

  it("leaves a line alone when the check has no word or the line no longer matches", () => {
    expect(findingTerm("name_drift", "“Elenor” is close to Eleanor")).toBeNull();
    expect(findingTerm("passive_voice", "Something else entirely")).toBeNull();
  });

  it("names only words the glossary has", () => {
    expect(Object.values(FINDING_TERMS).filter(([id]) => !glossaryEntry(id))).toEqual([]);
  });

  it("gives a role its own word, or Role", () => {
    expect(roleTerm("deuteragonist")).toBe("deuteragonist");
    expect(roleTerm("love_interest")).toBe("character-role");
  });
});
