import { describe, expect, it } from "vitest";
import { findInText } from "./find";

const words = (text: string, term: string, opts = {}) =>
  findInText(text, term, opts).map(([a, b]) => text.slice(a, b));

describe("find in a scene", () => {
  it("finds the words, never the tags around them", () => {
    const text = "“Not here.”<Calder> @Calder waited at [[Calder House]].";
    expect(words(text, "calder")).toEqual(["Calder", "Calder"]);
    expect(findInText(text, "<Calder>")).toEqual([]);
    expect(findInText(text, "@")).toEqual([]);
    expect(findInText(text, "[[")).toEqual([]);
  });

  it("matches case and whole words when asked", () => {
    expect(words("Tom said tomorrow, Tom.", "tom")).toEqual(["Tom", "tom", "Tom"]);
    expect(words("Tom said tomorrow, Tom.", "tom", { caseSensitive: true })).toEqual(["tom"]);
    expect(words("Tom said tomorrow, Tom.", "tom", { wholeWord: true })).toEqual(["Tom", "Tom"]);
  });

  it("never overlaps, so replacing all replaces each once", () => {
    expect(findInText("aaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });
});
