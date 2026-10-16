import { describe, expect, it } from "vitest";
import { GUIDES } from "../guides";
import { EMPTY } from "./emptyStates";

describe("the words of empty pages", () => {
  const all = Object.entries(EMPTY);

  it("send every page to a guide every writer has", () => {
    const bad = all
      .filter(([, c]) => !GUIDES.some((g) => g.id === c.guide?.id && g.modes.includes("writer")))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("lean on nothing Writer mode lacks, and write no em dash", () => {
    const loud = all
      .filter(([, c]) => /\b(AI|Assistant|Ollama|model)\b|—/.test(JSON.stringify(c)))
      .map(([k]) => k);
    expect(loud).toEqual([]);
  });
});
