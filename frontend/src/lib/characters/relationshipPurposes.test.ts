import { describe, expect, it } from "vitest";
import { RELATIONSHIP_PURPOSES, purposeHint, purposeLabel } from "./relationshipPurposes";

describe("what a relationship is for (doc 30 D6)", () => {
  it("says each preset plainly, with what it means", () => {
    for (const p of RELATIONSHIP_PURPOSES) {
      expect(p.label).not.toMatch(/-/);
      expect(p.hint.length).toBeGreaterThan(10);
      expect(p.hint).not.toMatch(/—/);
    }
    expect(purposeLabel("exposition-vehicle")).toBe("Carries information");
  });

  it("shows a purpose the writer typed as typed, with no meaning to make up", () => {
    expect(purposeLabel("keeps her honest")).toBe("keeps her honest");
    expect(purposeHint("keeps her honest")).toBeUndefined();
  });
});
