import { beforeEach, describe, expect, it } from "vitest";
import { guideStatus, writeProgress } from "./progress";

describe("the First story guide's place in the logo menu", () => {
  beforeEach(() => localStorage.clear());

  it("says nothing until opened, the step while on the way, and Done once the scene is written", () => {
    expect(guideStatus("s1")).toBeNull();
    writeProgress("s1", { step: 2, done: ["idea", "who"] });
    expect(guideStatus("s1")).toBe("3 of 7");
    writeProgress("s1", { step: 6, done: ["idea", "write"] });
    expect(guideStatus("s1")).toBe("Done");
  });
});
