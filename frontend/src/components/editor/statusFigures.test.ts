import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import { goalFor, ledFor, statusFigures } from "./statusFigures";

const node = (id: string, word_count: number, children: StructureNode[] = []) =>
  ({ id, title: id, word_count, children, level: 0, level_type: "scene" }) as unknown as StructureNode;

describe("ledFor", () => {
  it("is green when saved, yellow while saving, red when it cannot save", () => {
    expect(ledFor("idle").led).toBe("ok");
    expect(ledFor("saved").led).toBe("ok");
    expect(ledFor("unsaved").led).toBe("busy");
    expect(ledFor("saving").led).toBe("busy");
    expect(ledFor("offline").led).toBe("trouble");
    expect(ledFor("conflict").led).toBe("trouble");
  });
});

describe("statusFigures", () => {
  const book = [
    node("act1", 0, [node("ch1", 0, [node("s1", 100), node("s2", 50)]), node("ch2", 0, [node("s3", 30)])]),
    node("act2", 0, [node("s4", 20)]),
  ];

  it("sums the book and the open scene's parent, with the open scene as typed", () => {
    const f = statusFigures(book, "s2", 80);
    expect(f.scene).toBe(80);
    expect(f.parent?.node.id).toBe("ch1");
    expect(f.parent?.words).toBe(180);
    expect(f.book).toBe(230);
  });

  it("has no parent for a scene at the top level", () => {
    const flat = [node("a", 10), node("b", 5)];
    expect(statusFigures(flat, "a", 12)).toEqual({ scene: 12, parent: null, book: 17 });
  });
});

describe("goalFor", () => {
  it("is the upper end of the intended form, or none", () => {
    expect(goalFor("novelette")).toBe(17_500);
    expect(goalFor("epic_saga")).toBeNull();
    expect(goalFor("")).toBeNull();
    expect(goalFor(undefined)).toBeNull();
  });
});
