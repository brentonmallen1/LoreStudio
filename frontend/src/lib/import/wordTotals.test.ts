import { describe, expect, it } from "vitest";
import { wordTotals, wordsLabel } from "./wordTotals";

describe("wordTotals", () => {
  it("gives a heading with no text of its own the words inside it", () => {
    const totals = wordTotals([
      { id: "act", parent_id: null, word_count: 0 },
      { id: "s1", parent_id: "act", word_count: 120 },
      { id: "ch", parent_id: "act", word_count: 5 },
      { id: "s2", parent_id: "ch", word_count: 30 },
      { id: "empty", parent_id: null, word_count: 0 },
    ]);
    expect(totals.get("act")).toBe(155);
    expect(totals.get("ch")).toBe(35);
    expect(totals.get("s1")).toBe(120);
    expect(totals.get("empty")).toBe(0);
  });

  it("names the unit", () => {
    expect(wordsLabel(1)).toBe("1 word");
    expect(wordsLabel(0)).toBe("0 words");
    expect(wordsLabel(4210)).toBe("4,210 words");
  });
});
