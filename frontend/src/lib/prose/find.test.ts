import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// The same cases story-wide replace runs on the server (backend/tests/services/test_prose_syntax.py).
const CASES = JSON.parse(
  readFileSync(join(__dirname, "../../../../shared/prose-syntax/cases.json"), "utf8"),
) as {
  find: { text: string; term: string; case: boolean; whole: boolean; expect: string[] }[];
};

describe("find, as the server replaces", () => {
  it.each(CASES.find)("$term in $text", ({ text, term, case: caseSensitive, whole, expect: want }) => {
    expect(words(text, term, { caseSensitive, wholeWord: whole })).toEqual(want);
  });
});
