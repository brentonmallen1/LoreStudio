import { describe, expect, it } from "vitest";
import { nextSlot, slotFgVar, slotVar } from "./colorSlots";

describe("colour slots", () => {
  it("maps a slot to its theme token and falls back for none", () => {
    expect(slotVar(3)).toBe("var(--cat-3)");
    expect(slotFgVar(3)).toBe("var(--cat-3-fg)");
    expect(slotVar(0)).toBe("var(--color-text-subtle)");
    expect(slotVar(9, "red")).toBe("red");
    expect(slotVar(undefined)).toBe("var(--color-text-subtle)");
  });

  it("hands out the least-used slot, lowest first on a tie", () => {
    expect(nextSlot([])).toBe(1);
    expect(nextSlot([1, 2, 3])).toBe(4);
    expect(nextSlot([1, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(2);
    expect(nextSlot([0, null, undefined, 1])).toBe(2);
  });
});
