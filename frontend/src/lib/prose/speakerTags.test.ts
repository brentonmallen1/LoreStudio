import { describe, expect, it } from "vitest";
import { findSpeakerTags } from "./syntax";
import { hiddenTags, revealedLines, touches, type TaggedLine } from "./speakerTags";

// Text offsets stand in for the editor's positions: the logic only compares numbers.
const TEXT = '"Close the door."<Eleanor> She waited. "No." <Calder> Then: "Who?"<Nobody>';
const NAMED = new Set(["Eleanor", "Calder"]);
const LINES: (TaggedLine & { speaker: string })[] = findSpeakerTags(TEXT).map((t) => ({
  line: { from: t.quoteStart, to: t.end },
  tag: { from: t.tagStart, to: t.end },
  named: NAMED.has(t.speaker),
  speaker: t.speaker,
}));
const at = (needle: string, offset = 0) => {
  const i = TEXT.indexOf(needle) + offset;
  return { from: i, to: i };
};
const hidden = (sel: { from: number; to: number }) => hiddenTags(LINES, sel).map((l) => l.speaker);

describe("hidden speaker tags", () => {
  it("reads three tagged lines, one naming nobody", () => {
    expect(LINES.map((l) => [l.speaker, l.named])).toEqual([
      ["Eleanor", true],
      ["Calder", true],
      ["Nobody", false],
    ]);
  });

  it("hides every named tag while the caret is in plain prose", () => {
    expect(hidden(at("She waited", 3))).toEqual(["Eleanor", "Calder"]);
  });

  it("never hides a tag that names nobody: it is a warning", () => {
    expect(hidden(at("She waited")).includes("Nobody")).toBe(false);
  });

  it("shows a line's tag while the caret is inside its quote", () => {
    expect(hidden(at("the door"))).toEqual(["Calder"]);
  });

  it("shows it while the caret is inside the tag", () => {
    expect(hidden(at("Eleanor>", 3))).toEqual(["Calder"]);
  });

  it("shows it at every edge: before the opening mark, after the closing mark, after the >", () => {
    const line = LINES[0];
    for (const pos of [line.line.from, line.tag.from, line.tag.to])
      expect(hidden({ from: pos, to: pos })).toEqual(["Calder"]);
  });

  it("has no caret position inside a hidden tag", () => {
    for (let pos = 0; pos <= TEXT.length; pos++)
      for (const l of hiddenTags(LINES, { from: pos, to: pos }))
        expect(pos < l.tag.from || pos > l.tag.to).toBe(true);
  });

  it("counts the space before a tag as the tag's: the caret there shows it", () => {
    const calder = LINES[1];
    expect(TEXT.slice(calder.tag.from, calder.tag.to)).toBe(" <Calder>");
    expect(hidden({ from: calder.tag.from + 1, to: calder.tag.from + 1 })).toEqual(["Eleanor"]);
  });

  it("shows every line a selection touches", () => {
    const sel = { from: TEXT.indexOf("door"), to: TEXT.indexOf("No.") };
    expect(revealedLines(LINES, sel).map((l) => l.speaker)).toEqual(["Eleanor", "Calder"]);
    expect(hidden(sel)).toEqual([]);
  });

  it("touches both edges and nothing past them", () => {
    expect(touches({ from: 5, to: 9 }, { from: 9, to: 9 })).toBe(true);
    expect(touches({ from: 5, to: 9 }, { from: 5, to: 5 })).toBe(true);
    expect(touches({ from: 5, to: 9 }, { from: 10, to: 10 })).toBe(false);
    expect(touches({ from: 5, to: 9 }, { from: 1, to: 4 })).toBe(false);
  });
});
