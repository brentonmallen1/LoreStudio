import { describe, expect, it } from "vitest";
import { nearestSlot, nextSlot, slotFgVar, slotVar } from "./colorSlots";

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

  it("maps the old preset hexes to sensible slots", () => {
    expect(nearestSlot("#3b82f6")).toBe(1); // blue
    expect(nearestSlot("#ef4444")).toBe(2); // red
    expect(nearestSlot("#22c55e")).toBe(3); // green
    expect(nearestSlot("#8b5cf6")).toBe(4); // violet
    expect(nearestSlot("#f59e0b")).toBe(5); // amber
    expect(nearestSlot("#ec4899")).toBe(6); // pink
    expect(nearestSlot("#14b8a6")).toBe(7); // teal
    expect(nearestSlot("#6b7280")).toBe(8); // grey
    expect(nearestSlot("nonsense")).toBe(0);
  });
});
