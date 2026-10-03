import { describe, expect, it } from "vitest";
import { closeness, normalName, rankByName } from "./otherNames";

describe("other names", () => {
  it("normalises case, quotes and a leading article", () => {
    expect(normalName("The  Keeper’s Cottage")).toBe("keeper's cottage");
  });

  it("scores how close a written name is", () => {
    expect(closeness("The Keeper's Cottage", "Keeper's Cottage")).toBe(3);
    expect(closeness("Cottage", "Keeper's Cottage")).toBe(2);
    expect(closeness("Old Lighthouse Road", "The Lighthouse")).toBe(2);
    expect(closeness("Lighthouse Steps", "Lighthouse Keeper")).toBe(1);
    expect(closeness("Nell", "Eleanor Vance")).toBe(0);
    // By a form the prose uses, and a slip of the keys.
    expect(closeness("Calder", "The Visitor (Calder)")).toBe(3);
    expect(closeness("Caldre", "The Visitor (Calder)")).toBe(2);
    expect(closeness("Eleanr Vance", "Eleanor Vance")).toBe(2);
    expect(closeness("Tom", "Tim")).toBe(0);
  });

  it("ranks the closest first, by any of an entry's names", () => {
    const items = [
      { name: "The Shoals" },
      { name: "Keeper's Cottage" },
      { name: "Harbour", aliases: ["The Cottage Quay"] },
    ];
    const ranked = rankByName("The Keeper's Cottage", items);
    expect(ranked.map((r) => [r.item.name, r.score])).toEqual([
      ["Keeper's Cottage", 3],
      ["Harbour", 1],
      ["The Shoals", 0],
    ]);
  });
});
