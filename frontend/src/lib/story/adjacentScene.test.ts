import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import { adjacentScene } from "./adjacentScene";

const node = (id: string, position: number, level: number, children: StructureNode[] = []) =>
  ({ id, title: id, position, level, word_count: 0, children }) as unknown as StructureNode;

// Out of position order on purpose: reading order is by position, not by array order.
const structure = [
  node("ch2", 1, 0, [node("c", 0, 1), node("d", 1, 1)]),
  node("ch1", 0, 0, [node("b", 1, 1), node("a", 0, 1)]),
];
const template = { levels: [{ name: "Chapter" }, { name: "Scene" }], flat: false } as never;
const step = (id: string, dir: 1 | -1) => adjacentScene(structure, template, id, dir)?.id ?? null;

describe("⌘[ and ⌘] between scenes", () => {
  it("steps through the scenes in reading order, across chapters", () => {
    expect(step("a", 1)).toBe("b");
    expect(step("b", 1)).toBe("c");
    expect(step("c", -1)).toBe("b");
  });

  it("stops at either end", () => {
    expect(step("a", -1)).toBeNull();
    expect(step("d", 1)).toBeNull();
  });

  it("from a chapter's page: into its first scene, or back to the scene before it", () => {
    expect(step("ch2", 1)).toBe("c");
    expect(step("ch2", -1)).toBe("b");
  });

  it("knows nothing of a node not in the story", () => {
    expect(step("nope", 1)).toBeNull();
  });
});

describe("which scene is open", () => {
  it("reads it from the Write page's address, and nothing elsewhere", async () => {
    const { openSceneId } = await import("./adjacentScene");
    expect(openSceneId("/stories/s1/write/n9")).toBe("n9");
    expect(openSceneId("/stories/s1/write")).toBeNull();
    expect(openSceneId("/stories/s1/lorebook/characters/n9")).toBeNull();
  });
});
