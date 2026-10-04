import { describe, expect, it } from "vitest";
import { seriesPath, seriesSection } from "./sections";

describe("series sections", () => {
  it("each has a path, the overview the series' own", () => {
    expect(seriesPath("s")).toBe("/series/s");
    expect(seriesPath("s", "story-so-far", "book-0")).toBe("/series/s/story-so-far#book-0");
    expect(seriesSection("promises")).toBe("promises");
    expect(seriesSection("nonsense")).toBe("overview");
    expect(seriesSection(undefined)).toBe("overview");
  });
});
