import { describe, expect, it } from "vitest";
import type { NcEntry, NovelcrafterPreview } from "../../types/novelcrafter";
import { EMPTY_CHOICES, choiceOf, choose, groupEntries, optionsFor, tally } from "./novelcrafter";

const entry = (over: Partial<NcEntry>): NcEntry => ({
  id: "x",
  origin: "other/x",
  type: "other",
  name: "X",
  aliases: [],
  tags: [],
  excerpt: "",
  has_notes: false,
  has_thumbnail: false,
  urls: 0,
  target: "later",
  facet_of: null,
  facet_field: null,
  clash_with: null,
  clash_text: "",
  ...over,
});

const preview = (entries: NcEntry[]): NovelcrafterPreview => ({
  entries,
  snippets: [{ id: "s1", origin: "snippets/s1.md", title: "Logline", excerpt: "", target: "logline" }],
  chats: [],
  no_place: [],
  nothing_set: [],
  not_in_file: [],
  author: null,
  looks_like_screenplay: false,
});

const richard = entry({ id: "c1", name: "Richard", type: "character", target: "character" });
const physical = entry({
  id: "o1",
  name: "Richard (Physical)",
  target: "facet",
  facet_of: "c1",
  facet_field: "appearance",
});
const station = entry({ id: "r1", name: "Station 17: Pea Island", type: "lore", clash_with: "l1" });

describe("what comes over", () => {
  it("offers folding only where there is something to fold into", () => {
    expect(optionsFor(richard)).not.toContain("facet");
    expect(optionsFor(richard)).not.toContain("merge");
    expect(optionsFor(physical)).toContain("facet");
    expect(optionsFor(station)).toContain("merge");
  });

  it("keeps the defaults until the author chooses, and folds with what it folds into", () => {
    expect(choiceOf(physical, EMPTY_CHOICES)).toEqual({
      target: "facet",
      facet_of: "c1",
      facet_field: "appearance",
    });
    expect(choose(station, "merge")).toEqual({ target: "merge", merge_into: "l1" });
    expect(choose(physical, "facet").facet_field).toBe("appearance");
  });

  it("groups by destination and counts what has a home", () => {
    const p = preview([richard, physical, station]);
    expect(groupEntries(p, EMPTY_CHOICES).map((g) => g.target)).toEqual(["character", "facet", "later"]);
    expect(tally(p, EMPTY_CHOICES)).toEqual({ entries: 3, home: 3, later: 1, left: 0 });
    const skipped = { ...EMPTY_CHOICES, entries: { r1: { target: "skip" as const } } };
    expect(tally(p, skipped)).toEqual({ entries: 3, home: 3, later: 0, left: 1 });
  });
});
