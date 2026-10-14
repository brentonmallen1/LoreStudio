import { describe, expect, it } from "vitest";
import { helper } from "./helpers";
import { ways, whereNote } from "./show";

/** A helper as the guide, `?` and the slash menu write it (doc 26, P2). */
describe("showing a typing helper", () => {
  it("writes what you type, keys first when it has both", () => {
    expect(ways(helper("line"))).toEqual(["^"]);
    const note = ways(helper("note"));
    expect(note).toHaveLength(2);
    expect(note[1]).toBe("/note");
  });

  it("writes six element keys as one range", () => {
    const [keys] = ways(helper("script-keys"));
    expect(keys).toMatch(/1–6$/);
  });

  it("says where a helper works when it is not everywhere", () => {
    expect(whereNote(helper("line"))).toBe("");
    expect(whereNote(helper("script-tab"))).toBe("In a script");
    expect(whereNote(helper("tag"))).toBe("In prose");
    expect(whereNote(helper("stage-marker"))).toBe("In a play");
  });
});
