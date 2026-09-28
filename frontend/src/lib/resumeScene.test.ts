import { describe, expect, it } from "vitest";
import type { StructureNode } from "../types";
import { sceneToResume } from "./resumeScene";

const node = (id: string, updated_at: string, children: StructureNode[] = []) =>
  ({ id, updated_at, children }) as unknown as StructureNode;

const tree = [
  node("act", "2026-09-28T10:00:00", [
    node("ch", "2026-09-28T10:00:00", [node("s1", "2026-09-27T09:00:00"), node("s2", "2026-09-28T08:00:00")]),
  ]),
  node("s3", "2026-09-26T09:00:00"),
];

describe("which scene the Write page opens", () => {
  it("opens the scene a link names", () => {
    expect(sceneToResume("st", tree, "s3", "s1")?.id).toBe("s3");
  });

  it("otherwise the scene last open here", () => {
    expect(sceneToResume("st", tree, null, "s1")?.id).toBe("s1");
  });

  it("otherwise the scene edited most recently, never a chapter holding scenes", () => {
    expect(sceneToResume("st", tree, null, null)?.id).toBe("s2");
  });

  it("ignores ids that are no longer in the story", () => {
    expect(sceneToResume("st", tree, "gone", "also-gone")?.id).toBe("s2");
  });

  it("has nothing to open in an empty story", () => {
    expect(sceneToResume("st", [], null, null)).toBeNull();
  });
});
