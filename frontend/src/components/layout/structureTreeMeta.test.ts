import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import { parentForLevel } from "./structureTreeMeta";

const n = (id: string, level: number, parent_id: string | null, children: StructureNode[] = []) =>
  ({ id, level, parent_id, children }) as unknown as StructureNode;

const scene = n("s1", 2, "c1");
const tree = [n("a1", 0, null, [n("c1", 1, "a1", [scene])]), n("a2", 0, null)];

describe("where a new node goes", () => {
  it("top-level nodes have no parent", () => {
    expect(parentForLevel(tree, 0, scene)).toBeNull();
  });

  it("under the selection when it is one level up", () => {
    expect(parentForLevel(tree, 1, tree[1])?.id).toBe("a2");
  });

  it("under the selection's ancestor when the selection is deeper", () => {
    expect(parentForLevel(tree, 1, scene)?.id).toBe("a1");
    expect(parentForLevel(tree, 2, scene)?.id).toBe("c1");
  });

  it("under the last node at that level when nothing useful is selected", () => {
    expect(parentForLevel(tree, 1, null)?.id).toBe("a2");
    expect(parentForLevel(tree, 2, null)?.id).toBe("c1");
  });

  it("nowhere when the level above is empty", () => {
    expect(parentForLevel([n("a1", 0, null)], 2, null)).toBeNull();
  });
});
