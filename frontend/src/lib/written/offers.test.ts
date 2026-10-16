import { describe, expect, it } from "vitest";
import { jumpsLine, longRule, manyRule } from "./offers";

describe("the tidy-up offers' words", () => {
  it("names where the time jumps", () => {
    expect(jumpsLine([{ phrase: "By morning" }])).toBe("The time jumps at “By morning”.");
    expect(jumpsLine([{ phrase: "By morning" }, { phrase: "Three days on" }])).toBe(
      "The time jumps twice, at “By morning” and “Three days on”.",
    );
    expect(jumpsLine([{ phrase: "A" }, { phrase: "B" }, { phrase: "C" }])).toBe(
      "The time jumps three times, at “A”, “B” and “C”.",
    );
    expect(jumpsLine([])).toBe("");
  });

  it("says the rule each offer was found by", () => {
    expect(longRule(2500)).toMatch(/2,500 words or more/);
    expect(manyRule(8, "chapter")).toBe("LoreStudio offers this when one chapter holds 8 scenes or more.");
  });
});
