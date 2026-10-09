import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import { neighbourLine, sceneSheetPath, whoIsHere } from "./glance";

const cast = [
  { id: "e", name: "Eleanor Vance" },
  { id: "v", name: "The Visitor" },
  { id: "t", name: "Thomas Vance" },
];

describe("the scene at a glance", () => {
  it("the sheet lives under the scene's own address, so the crumbs still name it", () => {
    expect(sceneSheetPath("s1", "n1")).toBe("/stories/s1/write/n1/sheet");
  });

  it("the point of view leads, the rest follow in the cast's order", () => {
    expect(whoIsHere("e", ["v", "e"], cast)).toEqual([
      { id: "e", name: "Eleanor Vance", pov: true },
      { id: "v", name: "The Visitor", pov: false },
    ]);
  });

  it("a point of view the reading missed still leads; unknown ids are dropped", () => {
    expect(whoIsHere("t", ["v", "gone"], cast).map((p) => p.name)).toEqual(["Thomas Vance", "The Visitor"]);
    expect(whoIsHere(null, [], cast)).toEqual([]);
  });

  it("a neighbour says where it leaves things, or what happens in it", () => {
    const node = {
      exit_state: "",
      entry_state: "Picks up at dawn.",
      synopsis: "The boat lands.",
    } as StructureNode;
    expect(neighbourLine(node, "after")).toBe("Picks up at dawn.");
    expect(neighbourLine(node, "before")).toBe("The boat lands.");
    expect(neighbourLine({} as StructureNode, "before")).toBeNull();
  });
});
