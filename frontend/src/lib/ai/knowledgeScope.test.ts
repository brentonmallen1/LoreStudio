import { describe, expect, it } from "vitest";
import { FIXED_SCOPES, pickerValue, readPickerValue, scopeHint, scopeLabel } from "./knowledgeScope";

/**
 * The words matter here. "Knows everything written so far" read as omniscience while it
 * only ever meant the scenes the character was in — so the label is now explicit, and the
 * hypothetical it implied exists as its own scope.
 */
describe("interview knowledge scopes", () => {
  it("never describes presence as knowing everything", () => {
    const present = FIXED_SCOPES.find((s) => s.value === "present")!;
    expect(present.label).toBe("Knows the scenes they're in");
    expect(present.hint).toContain("Not the ones they were absent from");
  });

  it("marks the omniscient scope as a hypothetical", () => {
    const omniscient = FIXED_SCOPES.find((s) => s.value === "omniscient")!;
    expect(omniscient.label).toContain("hypothetical");
    expect(omniscient.hint).toContain("did not live");
  });

  it("reads a scene id as 'up to here' and a fixed value as itself", () => {
    expect(readPickerValue("present")).toEqual({ scope: "present" });
    expect(readPickerValue("node-7")).toEqual({ scope: "as_of", nodeId: "node-7" });
  });

  it("round-trips through the picker", () => {
    expect(pickerValue("omniscient", null)).toBe("omniscient");
    expect(pickerValue("as_of", "node-7")).toBe("node-7");
  });

  it("names the scene in the as-of label and hint", () => {
    expect(scopeLabel("as_of", "Chapter 7")).toBe("Knows up to Chapter 7");
    expect(scopeHint("as_of")).toContain("nothing after it");
  });
});
