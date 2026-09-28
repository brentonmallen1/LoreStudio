import { describe, expect, it } from "vitest";
import { humanize } from "./labels";

describe("humanize", () => {
  it("turns stored values into words", () => {
    expect(humanize("natural_feature")).toBe("Natural feature");
    expect(humanize("orbital_station")).toBe("Orbital station");
    expect(humanize("settlement")).toBe("Settlement");
  });
});
