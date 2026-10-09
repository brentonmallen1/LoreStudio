import { describe, expect, it } from "vitest";
import { joinSteps, splitSteps } from "./steps";

describe("a scene's key events as steps", () => {
  it("reads the seed's semicolons and an author's lines alike", () => {
    expect(splitSteps("Knock at the door; Eleanor's hesitation;  the Visitor's calm")).toEqual([
      "Knock at the door",
      "Eleanor's hesitation",
      "the Visitor's calm",
    ]);
    expect(splitSteps("One\n\nTwo\n")).toEqual(["One", "Two"]);
    expect(splitSteps(null)).toEqual([]);
  });

  it("writes them back one per line, dropping the empty ones", () => {
    expect(joinSteps(["Knock", "  ", " Hesitate "])).toBe("Knock\nHesitate");
    expect(splitSteps(joinSteps(["a", "b"]))).toEqual(["a", "b"]);
  });
});
