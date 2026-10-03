import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findMentions, findSpeakerTags, makeLexicon, readerText, type KnownName } from "./syntax";

// The same cases the server's tests run (backend/tests/services/test_prose_syntax.py).
const CASES = JSON.parse(
  readFileSync(join(__dirname, "../../../../shared/prose-syntax/cases.json"), "utf8"),
) as {
  known: KnownName[];
  mentions: { text: string; expect: [string, string, string | null][] }[];
  unknown_words: [string, string][];
  speakers: { text: string; expect: [string, string][] }[];
  reader: [string, string][];
};
const LEX = makeLexicon(CASES.known);

describe("the inline syntax, as the server reads it", () => {
  it.each(CASES.mentions)("mentions in $text", ({ text, expect: want }) => {
    expect(findMentions(text, LEX).map((m) => [text.slice(m.start, m.end), m.kind, m.name])).toEqual(want);
  });

  it.each(CASES.unknown_words)("an unknown mention in %s says %s", (text, words) => {
    expect(findMentions(text, LEX)[0].written).toBe(words);
  });

  it.each(CASES.speakers)("speaker tags in $text", ({ text, expect: want }) => {
    expect(findSpeakerTags(text).map((t) => [text.slice(t.quoteStart, t.quoteEnd), t.speaker])).toEqual(want);
  });

  it.each(CASES.reader)("reads %s as %s", (text, want) => {
    expect(readerText(text)).toBe(want);
  });
});
