import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import { sceneLine } from "./summary";

const node = (over: Record<string, unknown>) => ({ synopsis: "", ...over }) as unknown as StructureNode;

describe("a scene's line of what happens", () => {
  it("is the writer's own line when there is one", () => {
    expect(sceneLine(node({ synopsis: " She waits. ", first_line: "The knock came." }))).toEqual({
      text: "She waits.",
      fromFirstLine: false,
    });
  });

  it("is the first line of the prose, marked, when there is none", () => {
    expect(sceneLine(node({ first_line: "The knock came at nine." }))).toEqual({
      text: "The knock came at nine.",
      fromFirstLine: true,
    });
  });

  it("is nothing for a scene with no words and no line", () => {
    expect(sceneLine(node({}))).toEqual({ text: "", fromFirstLine: false });
  });
});
