import { describe, expect, it } from "vitest";
import "./sessions"; // registers the session types
import { MIN_WINDOW, contextWindowFor } from "./contextWindow";

describe("contextWindowFor", () => {
  it("uses the feature budget when the model can take it", () => {
    // whatif is a whole-story feature: 32k
    expect(contextWindowFor("whatif", 128_000)).toBe(32_768);
  });

  it("caps at what the model can take", () => {
    expect(contextWindowFor("whatif", 8_192)).toBe(8_192);
  });

  it("never returns a window too small to work", () => {
    expect(contextWindowFor("scene-assistant", 512)).toBe(MIN_WINDOW);
  });

  it("falls back to the model limit for an unknown session type", () => {
    expect(contextWindowFor("not-a-session", 128_000)).toBe(128_000);
  });
});
