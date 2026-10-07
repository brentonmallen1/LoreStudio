import { describe, expect, it } from "vitest";
import { thinksFor } from "./thinking";

describe("thinksFor", () => {
  it("follows the feature table where it helps, and the choice otherwise", () => {
    expect(thinksFor("plot-holes", "helps")).toBe(true);
    expect(thinksFor("scene-chat", "helps")).toBe(true);
    expect(thinksFor("interview", "helps")).toBe(false);
    expect(thinksFor("interview", "always")).toBe(true);
    expect(thinksFor("plot-holes", "off")).toBe(false);
    expect(thinksFor(undefined, "helps")).toBe(false);
  });
});
