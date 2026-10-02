import { describe, expect, it } from "vitest";
import { sentenceAround } from "./sentence";

const text = "The barometer fell. She climbed up! “Is that a boat?” she said. Then nothing";

describe("sentenceAround", () => {
  const at = (needle: string) => {
    const [s, e] = sentenceAround(text, text.indexOf(needle));
    return text.slice(s, e);
  };
  it("finds the sentence the cursor is in", () => {
    expect(at("barometer")).toBe("The barometer fell.");
    expect(at("climbed")).toBe("She climbed up!");
  });
  it("keeps closing quotes with the sentence they end", () => {
    expect(at("boat")).toBe("“Is that a boat?”");
  });
  it("runs to the end of a paragraph with no full stop", () => {
    expect(at("nothing")).toBe("Then nothing");
  });
  it("falls back to the whole paragraph when there is nothing to find", () => {
    expect(sentenceAround("   ", 1)).toEqual([0, 3]);
  });
});
