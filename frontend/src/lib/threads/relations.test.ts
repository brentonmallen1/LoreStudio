import { describe, expect, it } from "vitest";
import type { PlotThread } from "../../types";
import { relations, triesLine } from "./relations";

const index = new Map(["a", "b", "c", "d", "e"].map((id, i) => [id, i]));
const thread = (id: string, opens: string, closes: string, roles: [string, string][] = []): PlotThread =>
  ({
    id,
    name: id.toUpperCase(),
    status: "resolved",
    opens_at_node_id: opens,
    closes_at_node_id: closes,
    appearances: roles.map(([node_id, role]) => ({ node_id, role })),
  }) as PlotThread;

describe("thread relations", () => {
  it("says what nests, what shares a span and what crosses", () => {
    const outer = thread("outer", "a", "e");
    const inner = thread("inner", "b", "c");
    const twin = thread("twin", "a", "e");
    const cross = thread("cross", "c", "e");
    expect(relations(outer, [outer, inner, twin], index)).toEqual([
      "Opens and closes with TWIN.",
      "INNER opens and closes inside it, so they nest.",
    ]);
    expect(relations(inner, [outer, inner], index)).toEqual(["Sits inside OUTER."]);
    expect(relations(thread("x", "b", "d"), [cross], index)[0]).toMatch(/^Crosses CROSS/);
  });

  it("counts the tries in reading order", () => {
    const t = thread("t", "a", "e", [
      ["d", "costs"],
      ["b", "fails"],
      ["c", "fails_worse"],
    ]);
    expect(triesLine(t, index)).toBe("Three tries: one fails, one fails worse, one succeeds at a cost.");
  });
});
