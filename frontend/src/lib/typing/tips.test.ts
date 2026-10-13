import { describe, expect, it } from "vitest";
import { helper, type HelperId } from "./helpers";
import { namedByHand, placeholderFor, tagsByHand, tipLine } from "./tips";

/** Tips while writing (doc 26, P4): what they say and what counts as the long way. */
describe("a tip's line", () => {
  it("names the long way, then what to type or press", () => {
    expect(tipLine(helper("image"))).toBe("Quicker than ⋯ › Insert image: type /image.");
    expect(tipLine(helper("script-tab"))).toBe(
      "Quicker than choosing the element from the palette: press Tab.",
    );
    expect(tipLine(helper("note"))).toMatch(
      /^Quicker than the Note button on a selection: press .+N, or type \/note\.$/,
    );
  });
});

describe("a speaker written by hand", () => {
  it("is a name and said after a quote, either way round", () => {
    expect(tagsByHand("“Run,” Eleanor said.")).toBe(true);
    expect(tagsByHand('"Run," said Eleanor.')).toBe(true);
    expect(tagsByHand("“Down there,” Old Tom whispered, pointing.")).toBe(true);
  });

  it("is not a line ^ wrote, nor a quote without a speaker", () => {
    expect(tagsByHand("“Run,”<Eleanor> and she ran.")).toBe(false);
    expect(tagsByHand("“Run,” and she ran.")).toBe(false);
    expect(tagsByHand("Eleanor said nothing.")).toBe(false);
  });
});

describe("a name typed out", () => {
  const names = ["Eleanor", "Old Tom", "Al"];

  it("counts once the name is finished", () => {
    expect(namedByHand("and Eleanor ", names)).toBe(true);
    expect(namedByHand("to Old Tom,", names)).toBe(true);
    expect(namedByHand("and Eleano", names)).toBe(false);
    expect(namedByHand("and Eleanor", names)).toBe(false);
  });

  it("is a whole word, and a short name is too easily a word", () => {
    expect(namedByHand("MacEleanor ", names)).toBe(false);
    expect(namedByHand("@Eleanor ", names)).toBe(false);
    expect(namedByHand("and Al ", names)).toBe(false);
  });
});

describe("the empty scene's placeholder", () => {
  const none = new Set<HelperId>();

  it("names the first helper not yet used", () => {
    expect(placeholderFor("prose", none, true)).toBe("Begin writing… · ^ gives someone a line");
    expect(placeholderFor("prose", new Set<HelperId>(["line"]), true)).toBe(
      "Begin writing… · @ names a character",
    );
    expect(placeholderFor("screenplay", none, true)).toBe("Write what we see. ^ gives someone a line.");
    expect(placeholderFor("stage_play", new Set<HelperId>(["line", "mention", "slash"]), true)).toBe(
      "Write what the audience sees.",
    );
  });

  it("names none while tips are off", () => {
    expect(placeholderFor("prose", none, false)).toBe("Begin writing…");
  });
});
