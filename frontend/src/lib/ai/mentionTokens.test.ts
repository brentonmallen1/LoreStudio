import { describe, expect, it } from "vitest";
import type { Character, Location, PlotThread, StructureNode } from "../../types";
import { acceptMention, activeMention, candidates } from "./mentionTokens";

const pool = {
  characters: [
    { id: "c1", name: "Eleanor Vance" },
    { id: "c2", name: "Margaret Holt" },
  ] as Character[],
  locations: [{ id: "l1", name: "The Lighthouse" }] as Location[],
  scenes: [{ id: "s1", title: "The Light" }] as StructureNode[],
  threads: [{ id: "t1", name: "The Missing Logs" }] as PlotThread[],
};

describe("activeMention", () => {
  it("finds an @ that starts a word, with what was typed after it", () => {
    expect(activeMention("ask @Mar", 8)).toEqual({ start: 4, query: "Mar" });
    expect(activeMention("@", 1)).toEqual({ start: 0, query: "" });
  });
  it("ignores an @ inside a word, a long query, or one behind the caret", () => {
    expect(activeMention("mail@example", 12)).toBeNull();
    expect(activeMention("@" + "x".repeat(40), 41)).toBeNull();
    expect(activeMention("@Mar done", 4)).toEqual({ start: 0, query: "Mar" });
    expect(activeMention("hello", 5)).toBeNull();
  });
});

describe("candidates", () => {
  it("ranks a name start above a word start above a substring", () => {
    expect(candidates("the l", pool).map((c) => c.label)).toEqual(["The Lighthouse", "The Light"]);
    expect(candidates("ma", pool).map((c) => c.label)).toEqual(["Margaret Holt"]);
    expect(candidates("light", pool).map((c) => c.label)).toEqual(["The Lighthouse", "The Light"]);
  });
  it("offers everything for an empty query, minus what is already mentioned", () => {
    expect(candidates("", pool)).toHaveLength(5);
    expect(
      candidates("", pool, [{ kind: "character", id: "c1", label: "Eleanor Vance" }]).map((c) => c.id),
    ).not.toContain("c1");
  });
});

describe("acceptMention", () => {
  it("replaces the typed mention with the name and moves the caret after it", () => {
    const m = activeMention("ask @Mar about", 8)!;
    expect(acceptMention("ask @Mar about", 8, m, "Margaret Holt")).toEqual({
      text: "ask @Margaret Holt about",
      caret: 18,
    });
    expect(acceptMention("ask @Mar", 8, activeMention("ask @Mar", 8)!, "Margaret Holt")).toEqual({
      text: "ask @Margaret Holt ",
      caret: 19,
    });
  });
});
