import { describe, expect, it } from "vitest";
import { countWord, startHereStory, tutorialOutline } from "./startHere";
import type { StructureNode } from "../../types";

const node = (id: string, title: string, position: number, extra: Partial<StructureNode> = {}) =>
  ({
    id,
    title,
    position,
    parent_id: null,
    children: [],
    metadata_: {},
    ...extra,
  }) as unknown as StructureNode;
const lesson = (number: number) => ({ lesson: { text: "t", practice: [], number, of: 3, topic: "x" } });

describe("Start here (doc 30 D4)", () => {
  it("opens lesson 1, whatever was edited last", () => {
    const a = node("a", "1. Writing", 0, {
      children: [
        node("s2", "A quiet page", 1, { parent_id: "a", metadata_: lesson(2) } as Partial<StructureNode>),
        node("s1", "Start here", 0, { parent_id: "a", metadata_: lesson(1) } as Partial<StructureNode>),
      ],
    });
    const b = node("b", "2. Dialogue", 1, {
      children: [node("s3", "A line", 0, { parent_id: "b", metadata_: lesson(3) } as Partial<StructureNode>)],
    });
    const got = tutorialOutline([b, a]);
    expect(got.first).toBe("s1");
    expect(got.topics).toEqual(["Writing", "Dialogue"]);
    expect(got.lessons).toBe(3);
  });

  it("shows only while the account has the tutorial and has not used it", () => {
    expect(startHereStory({ tutorial: { prose: "t1" } })).toBe("t1");
    expect(startHereStory({ tutorial: { prose: "t1" }, ui: { start_here: "done" } })).toBeNull();
    expect(startHereStory({ tutorial: {} })).toBeNull();
    expect(startHereStory(undefined)).toBeNull();
  });

  it("says small counts as words", () => {
    expect(countWord(9)).toBe("nine");
    expect(countWord(40)).toBe("40");
  });
});
