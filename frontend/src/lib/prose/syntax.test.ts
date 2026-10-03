import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countWordsClean } from "../../components/editor/segmentMeta";
import {
  findMentions,
  findQuotes,
  findSpeakerTags,
  makeLexicon,
  nameForms,
  presencePatterns,
  readerText,
  timesNamed,
  speakerName,
  type KnownName,
} from "./syntax";

// The same cases the server's tests run (backend/tests/services/test_prose_syntax.py).
const CASES = JSON.parse(
  readFileSync(join(__dirname, "../../../../shared/prose-syntax/cases.json"), "utf8"),
) as {
  known: KnownName[];
  mentions: { text: string; expect: [string, string, string | null][] }[];
  unknown_words: [string, string][];
  speakers: { text: string; expect: [string, string][] }[];
  reader: [string, string][];
  speaker_names: [string, string | null][];
  quotes: { text: string; expect: string[] }[];
  name_forms: [string, string[]][];
  word_count: { html: string; text: string; words: number }[];
  presence: { text: string; expect: string[] }[];
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

  it.each(CASES.speaker_names)("a tag <%s> names %s", (written, name) => {
    expect(speakerName(LEX, written)).toBe(name);
  });

  it.each(CASES.name_forms)("%s is called %j", (label, forms) => {
    expect([...nameForms(label)].sort()).toEqual(forms);
  });

  it.each(CASES.presence)("$text names $expect", ({ text, expect: want }) => {
    const patterns = presencePatterns(CASES.known);
    const cast = CASES.known.filter((k) => k.kind === "character").map((k) => k.name);
    expect(cast.filter((n) => timesNamed(text, patterns.get(n) ?? []) > 0)).toEqual(want);
  });

  it.each(CASES.word_count)("$text is $words words", ({ text, words }) => {
    expect(countWordsClean(text)).toBe(words);
  });

  it.each(CASES.quotes)("untagged quotes in $text", ({ text, expect: want }) => {
    expect(findQuotes(text).map((q) => q.words)).toEqual(want);
  });
});
