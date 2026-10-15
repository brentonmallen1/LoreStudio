import { describe, expect, it } from "vitest";
import { useUIStore } from "./uiStore";

describe("the Outline", () => {
  it("opens the strip out, even from a page where it sits collapsed", () => {
    const ui = useUIStore.getState();
    ui.setStripOnProse(false);
    expect(useUIStore.getState().stripWidth).toBe("strip");
    ui.openOutline();
    ui.setStripOnProse(true);
    expect(useUIStore.getState().stripWidth).toBe("scenes");
  });
});
