import { describe, expect, it } from "vitest";
import { GUIDES, withKeys } from "./index";

describe("guides", () => {
  it("write shortcuts as {{key:id}}, never as a hard-coded combo", () => {
    for (const g of GUIDES) {
      expect(g.body, `${g.id} has an unresolved {{key:…}}`).not.toMatch(/\{\{key:/);
    }
  });

  it("leaves an unknown shortcut id visible so the mistake shows", () => {
    expect(withKeys("press {{key:nope}}")).toBe("press {{key:nope}}");
  });
});
