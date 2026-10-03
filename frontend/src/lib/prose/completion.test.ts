import { describe, expect, it } from "vitest";
import { anyStartsWith, detectTrigger, ghostText, quotePair, suggest, type Entry } from "./completion";

const ENTRIES: Entry[] = [
  { kind: "character", name: "Eleanor Vance", role: "protagonist" },
  { kind: "character", name: "Thomas Vance", aliases: ["Tom"] },
  { kind: "character", name: "Dr. Priya Sharma" },
  { kind: "character", name: "The Visitor (Calder)" },
  { kind: "place", name: "Keeper's Cottage", aliases: ["The Keeper's Cottage"] },
  { kind: "place", name: "The Lighthouse" },
];
const has = (q: string) => anyStartsWith(q, ENTRIES, ["character", "place"]);

describe("which picker the text asks for", () => {
  it.each([
    ["She saw @Ele", "mention", "Ele"],
    ["@", "mention", ""],
    ["“@Tho", "mention", "Tho"],
    ["(@Dr. Pri", "mention", "Dr. Pri"],
    ["—@Cal", "mention", "Cal"],
    ["Walk to [[Kee", "place", "Kee"],
    ["Walk to [[", "place", ""],
    ["“Not here.”<Ca", "speaker", "Ca"],
    ['"Not here." <', "speaker", ""],
    ["‘No.’<Ma", "speaker", "Ma"],
    ["^", "line", ""],
    ["Then ^Ele", "line", "Ele"],
  ])("%s → %s %s", (before, mode, query) => {
    expect(detectTrigger(before, has)).toMatchObject({ mode, query });
  });

  it.each([["me@host"], ["She saw @Eleanor and"], ["@ "], ["x<5"], ["2^8"], ["[[Keeper's Cottage]] and"]])(
    "%s asks for nothing",
    (before) => {
      expect(detectTrigger(before, has)).toBeNull();
    },
  );

  it("says where the typed syntax starts", () => {
    expect(detectTrigger("She saw @Ele", has)!.start).toBe(8);
    expect(detectTrigger("To [[Kee", has)!.start).toBe(3);
    expect(detectTrigger("“No.”<Ca", has)!.start).toBe(6);
    expect(detectTrigger("Then ^Ele", has)!.start).toBe(5);
  });
});

describe("what a picker offers", () => {
  it("names that start with the query, then names with a word that does", () => {
    expect(suggest("mention", "v", ENTRIES).map((c) => c.words)).toEqual([
      "Eleanor Vance",
      "The Visitor (Calder)",
      "Thomas Vance",
      "v",
    ]);
  });

  it("offers other names when typed, writing them as typed", () => {
    const tom = suggest("mention", "to", ENTRIES)[0];
    expect(tom).toMatchObject({ name: "Thomas Vance", words: "Tom", via: "Tom" });
    expect(suggest("mention", "", ENTRIES).some((c) => c.via)).toBe(false);
  });

  it("finds a name by any word, brackets and all", () => {
    expect(suggest("speaker", "cal", ENTRIES)[0].name).toBe("The Visitor (Calder)");
    expect(suggest("place", "kee", ENTRIES).filter((c) => !c.create)).toHaveLength(1);
  });

  it("keeps to places after [[ and characters after <", () => {
    expect(
      suggest("place", "the", ENTRIES)
        .filter((c) => !c.create)
        .map((c) => c.words),
    ).toEqual(["The Lighthouse", "The Keeper's Cottage"]);
    expect(suggest("speaker", "", ENTRIES).every((c) => c.kind === "character")).toBe(true);
  });

  it("puts the likeliest speaker first", () => {
    expect(suggest("speaker", "", ENTRIES, "Thomas Vance")[0].name).toBe("Thomas Vance");
  });

  it("offers a new entry of the picker's kind when nothing is called that", () => {
    expect(suggest("place", "Old Boathouse", ENTRIES).at(-1)).toMatchObject({
      kind: "place",
      name: "Old Boathouse",
      create: true,
    });
    expect(suggest("mention", "tom", ENTRIES).some((c) => c.create)).toBe(false);
  });
});

describe("the faint rest of a suggestion", () => {
  it("is what Tab would add", () => {
    const [first] = suggest("mention", "ele", ENTRIES);
    expect(ghostText("ele", first)).toBe("anor Vance");
    expect(ghostText("", first)).toBe("");
    expect(ghostText("van", first)).toBe("");
  });
});

describe("quote marks for a new line", () => {
  it("follow the scene, curly by default", () => {
    expect(quotePair("")).toEqual(["“", "”"]);
    expect(quotePair('"A," she said. "B."')).toEqual(['"', '"']);
    expect(quotePair("“A”")).toEqual(["“", "”"]);
  });
});
