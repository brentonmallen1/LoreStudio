import { describe, expect, it } from "vitest";
import type { StructureNode } from "../../types";
import type { Finding } from "../../types/findings";
import { findingsForEntity, findingsForNode, groupByPlace, groupByUrgency } from "./group";

const anchor = { node_id: null, character_id: null, location_id: null, thread_id: null, twist_id: null };

function finding(id: string, over: Partial<Finding> = {}): Finding {
  return {
    id,
    kind: "prose",
    severity: "mid",
    source: "local",
    check: "x",
    text: id,
    evidence: "",
    suggestion: "",
    where: "",
    anchor,
    action: "open_scene",
    fix: null,
    run_id: null,
    feature: null,
    created_at: null,
    ...over,
  };
}

function node(id: string, title: string, position: number, children: StructureNode[] = []): StructureNode {
  return { id, title, position, children } as unknown as StructureNode;
}

const structure = [
  node("ch2", "Chapter 2", 1, [node("s3", "Storm", 0)]),
  node("ch1", "Chapter 1", 0, [node("s2", "Lamp", 1), node("s1", "Arrival", 0)]),
];

describe("groupByPlace", () => {
  it("orders scenes by reading order, then entities, then the whole story", () => {
    const groups = groupByPlace(
      [
        finding("story-wide"),
        finding("storm", { anchor: { ...anchor, node_id: "s3" } }),
        finding("margaret", { anchor: { ...anchor, character_id: "c1" }, where: "Margaret" }),
        finding("lamp", { anchor: { ...anchor, node_id: "s2" } }),
        finding("ch2", { anchor: { ...anchor, node_id: "ch2" } }),
      ],
      structure,
    );
    expect(groups.map((g) => [g.label, g.sub])).toEqual([
      ["Lamp", "Chapter 1"],
      ["Chapter 2", ""],
      ["Storm", "Chapter 2"],
      ["Margaret", "Character"],
      ["The whole story", ""],
    ]);
  });

  it("puts the worst first inside a group", () => {
    const at = { ...anchor, node_id: "s1" };
    const [g] = groupByPlace(
      [finding("b", { anchor: at, severity: "low" }), finding("a", { anchor: at, severity: "high" })],
      structure,
    );
    expect(g.findings.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("sends a finding about a deleted scene to the story group", () => {
    const groups = groupByPlace([finding("gone", { anchor: { ...anchor, node_id: "nope" } })], structure);
    expect(groups.map((g) => g.id)).toEqual(["story"]);
  });
});

describe("groupByUrgency", () => {
  it("keeps only buckets with something in them, high first", () => {
    const groups = groupByUrgency([finding("a", { severity: "low" }), finding("b", { severity: "high" })]);
    expect(groups.map((g) => g.id)).toEqual(["high", "low"]);
  });
});

describe("filters", () => {
  it("finds a scene's and an entity's findings", () => {
    const fs = [
      finding("a", { anchor: { ...anchor, node_id: "s1" } }),
      finding("b", { anchor: { ...anchor, character_id: "c1" } }),
    ];
    expect(findingsForNode(fs, "s1").map((f) => f.id)).toEqual(["a"]);
    expect(findingsForNode(fs, null)).toEqual([]);
    expect(findingsForEntity(fs, "character_id", "c1").map((f) => f.id)).toEqual(["b"]);
  });
});
