import { describe, expect, it } from "vitest";
import { TOOLS, toolsFor } from "./panel";

describe("the tools a story has", () => {
  it("shows The novel only in a script adapted from one (doc 25, P10)", () => {
    expect(toolsFor({ adapted_from_id: "novel-1" })).toEqual(TOOLS);
    expect(toolsFor({ adapted_from_id: null })).not.toContain("novel");
    expect(toolsFor(null)).toEqual(TOOLS.filter((t) => t !== "novel"));
  });
});
