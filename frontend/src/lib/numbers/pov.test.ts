import { describe, expect, it } from "vitest";
import type { Character, StructureNode } from "../../types";
import { povRotation } from "./pov";

const scene = (pov: string | null) => ({ pov_character_id: pov }) as StructureNode;
const who = (id: string) => ({ id, name: id }) as Character;

describe("the POV rotation", () => {
  it("reads each scene's own POV, or the book's, in reading order", () => {
    const r = povRotation([scene(null), scene("tom"), scene(null)], "eleanor", [who("eleanor"), who("tom")]);
    expect(r.perScene).toEqual(["eleanor", "tom", "eleanor"]);
    expect(r.rows.map((x) => [x.character.id, x.scenes, x.longestGap])).toEqual([
      ["eleanor", [0, 2], 1],
      ["tom", [1], 0],
    ]);
  });

  it("calls a viewpoint overdue when it has been away far longer than its turn", () => {
    const scenes = ["a", "b", "a", "b", "a", "a", "a", "a", "a", "a"].map(scene);
    const [a, b] = povRotation(scenes, null, [who("a"), who("b")]).rows;
    expect(b.since).toBe(6);
    expect(b.overdue).toBe(true);
    expect(a.overdue).toBe(false);
  });

  it("has nothing to rotate with one viewpoint, or none", () => {
    expect(povRotation([scene("a"), scene("a")], null, [who("a")]).rows[0].overdue).toBe(false);
    expect(povRotation([scene(null)], null, []).rows).toEqual([]);
  });
});
