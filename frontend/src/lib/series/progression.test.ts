import { describe, expect, it } from "vitest";
import { progressionSteps, stepLabel } from "./progression";

const v = (position: number, value: string) => ({ story_id: `s${position}`, position, value });

describe("progressionSteps", () => {
  it("folds books that say the same thing into one step", () => {
    const steps = progressionSteps([v(1, "Guarded."), v(0, "Guarded. "), v(2, "Opening up.")]);
    expect(steps.map(stepLabel)).toEqual(["Books 1 and 2", "Book 3"]);
    expect(steps[0].storyIds).toEqual(["s0", "s1"]);
    expect(steps[1].value).toBe("Opening up.");
  });

  it("keeps a return to an earlier value as its own step", () => {
    const steps = progressionSteps([v(0, "A"), v(1, "B"), v(2, "A"), v(3, "A")]);
    expect(steps.map(stepLabel)).toEqual(["Book 1", "Book 2", "Books 3 and 4"]);
    expect(stepLabel({ from: 0, to: 3 })).toBe("Books 1–4");
  });
});
