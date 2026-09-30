import { describe, expect, it } from "vitest";
import { closeDelta, isOverlayPath, originLabel, type OverlayOrigin } from "./overlay";

const origin = (idx: number | null): OverlayOrigin => ({
  pathname: "/stories/s1/write",
  search: "",
  hash: "",
  idx,
});

describe("overlay paths", () => {
  it("covers settings and guides and everything under them", () => {
    expect(isOverlayPath("/settings")).toBe(true);
    expect(isOverlayPath("/settings/ai-prompts")).toBe(true);
    expect(isOverlayPath("/guides/getting-started")).toBe(true);
  });

  it("leaves ordinary pages alone, including ones that merely start alike", () => {
    expect(isOverlayPath("/")).toBe(false);
    expect(isOverlayPath("/stories/s1/write")).toBe(false);
    expect(isOverlayPath("/settingsx")).toBe(false);
  });
});

describe("closing", () => {
  it("steps back past every entry the overlay pushed", () => {
    // Opened at 4, then two section links: closing is three steps back, to the origin itself.
    expect(closeDelta(origin(4), 7)).toBe(-3);
  });

  it("navigates instead when there is nothing behind to step back to", () => {
    expect(closeDelta(null, 3)).toBeNull();
    expect(closeDelta(origin(null), 3)).toBeNull();
    expect(closeDelta(origin(5), null)).toBeNull();
    expect(closeDelta(origin(5), 5)).toBeNull();
  });
});

describe("the close button names the page underneath", () => {
  it("uses the story route's label", () => {
    expect(originLabel("/stories/s1/write")).toBe("Write");
    expect(originLabel("/stories/s1/chronicle")).toBe("Chronicle");
    expect(originLabel("/stories/s1")).toBe("Overview");
    expect(originLabel("/stories/s1/lorebook/characters/c1")).toBe("Characters");
    expect(originLabel("/stories/s1/lorebook")).toBe("Lorebook");
  });

  it("calls anything outside a story the dashboard", () => {
    expect(originLabel("/")).toBe("Dashboard");
  });
});
