import { describe, expect, it } from "vitest";
import type { PlotThread } from "../../types";
import { isTry, ROLES, roleLabel, statusLine } from "./roles";

const thread = (over: Partial<PlotThread>): PlotThread =>
  ({
    status: "open",
    opens_at_node_id: null,
    closes_at_node_id: null,
    appearances: [],
    ...over,
  }) as PlotThread;
const title = (id: string) => ({ s1: "The Light", s9: "The New Entry" })[id] ?? "?";

describe("thread roles", () => {
  it("names every role the server accepts, the tries among them", () => {
    expect(ROLES.map((r) => r.value)).toEqual([
      "opens",
      "moves",
      "turns",
      "complicates",
      "fails",
      "fails_worse",
      "costs",
      "succeeds",
      "closes",
    ]);
    expect(ROLES.filter((r) => isTry(r.value)).map((r) => r.value)).toEqual([
      "fails",
      "fails_worse",
      "costs",
      "succeeds",
    ]);
    expect(roleLabel("costs")).toBe("succeeds, at a cost");
  });

  it("says where the thread stands from its scenes", () => {
    expect(statusLine(thread({ status: "planned" }), title)).toBe("Planned: it is in no scene yet.");
    expect(statusLine(thread({ opens_at_node_id: "s1" }), title)).toContain("opens in The Light");
    expect(statusLine(thread({}), title)).toContain("no scene opens it yet");
    expect(statusLine(thread({ status: "resolved", closes_at_node_id: "s9" }), title)).toBe(
      "Resolved: it closes in The New Entry.",
    );
  });
});
