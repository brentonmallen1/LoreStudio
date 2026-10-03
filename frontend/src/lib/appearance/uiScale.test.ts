import { describe, expect, it } from "vitest";
import { ROOT_PX, UI_SCALES, isUiScale, scaleFactor, scaledPx, stepScale } from "./uiScale";
import { FONT_SIZES, useUIStore } from "../../stores/uiStore";

describe("interface size", () => {
  it("steps up and down and stops at the ends", () => {
    expect(stepScale("default", 1)).toBe("large");
    expect(stepScale("default", -1)).toBe("small");
    expect(stepScale("larger", 1)).toBe("larger");
    expect(stepScale("small", -1)).toBe("small");
  });

  it("knows its own values", () => {
    expect(isUiScale("large")).toBe(true);
    expect(isUiScale("huge")).toBe(false);
    expect(isUiScale(null)).toBe(false);
    expect(scaleFactor("default")).toBe(1);
    expect(scaledPx(96, "larger")).toBe(120);
  });

  it("goes up in order", () => {
    const factors = UI_SCALES.map((s) => s.factor);
    expect([...factors].sort((a, b) => a - b)).toEqual(factors);
  });

  it("never moves the writing: the prose sizes are px from a fixed base, not rem", () => {
    for (const size of Object.values(FONT_SIZES)) {
      expect(size).toMatch(/^\d+(\.\d+)?px$/);
    }
    expect(FONT_SIZES.medium).toBe(`${ROOT_PX}px`);
  });

  it("sets --ui-scale on the root and remembers it", () => {
    useUIStore.getState().setUiScale("larger");
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.25");
    expect(localStorage.getItem("ls_ui_scale")).toBe("larger");
    useUIStore.getState().setUiScale("default");
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1");
  });
});
