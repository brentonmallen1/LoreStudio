import { describe, expect, it } from "vitest";
import { closeness, mentionRanges, normalName, rankByName } from "./otherNames";

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

  it("finds a mention's syntax whatever its case", () => {
    const text = "At [[the cottage]], @Nell and @Nellie met [[The Cottage]].";
    expect(mentionRanges(text, "setting", "The Cottage")).toEqual([
      { from: 3, to: 18, words: "the cottage" },
      { from: 42, to: 57, words: "The Cottage" },
    ]);
    expect(mentionRanges(text, "character", "Nell")).toEqual([{ from: 20, to: 25, words: "Nell" }]);
  });
});
