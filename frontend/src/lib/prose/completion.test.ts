import { describe, expect, it } from "vitest";
import {
  anyStartsWith,
  cueTrigger,
  detectTrigger,
  ghostText,
  quotePair,
  suggest,
  titleCase,
  type Entry,
  emptyPrompt,
} from "./completion";

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

describe("series elements in the picker", () => {
  const book: Entry[] = [{ kind: "character", name: "Margot Vance" }];
  const fromSeries: Entry[] = [{ kind: "character", name: "Margaret Holt", fromSeries: "el-1" }];

  it("come after the book's own, marked to be brought in", () => {
    const out = suggest("mention", "mar", [...book, ...fromSeries]);
    expect(out.map((c) => c.name)).toEqual(["Margot Vance", "Margaret Holt", "mar"]);
    expect(out.find((c) => c.name === "Margaret Holt")?.fromSeries).toBe("el-1");
    expect(out.find((c) => c.name === "Margot Vance")).not.toHaveProperty("fromSeries");
  });

  it("are not offered as new when the name is the series' one", () => {
    const out = suggest("mention", "Margaret Holt", [...book, ...fromSeries]);
    expect(out.some((c) => c.create)).toBe(false);
  });
});

describe("a script's character cue (doc 25)", () => {
  it("asks who speaks, until the extensions start", () => {
    expect(cueTrigger("ELE")).toEqual({ mode: "cue", query: "ELE", start: 0 });
    expect(cueTrigger("ELEANOR (V")).toBeNull();
    expect(cueTrigger("")).toBeNull();
  });

  it("offers the cast, matched whatever the case", () => {
    expect(suggest("cue", "ELE", ENTRIES)[0].name).toBe("Eleanor Vance");
    expect(suggest("cue", "THE L", ENTRIES).every((c) => c.kind === "character")).toBe(true);
  });

  it("names a new character the way names are written, not in the cue's capitals", () => {
    expect(suggest("cue", "MRS. HALE", ENTRIES).at(-1)).toMatchObject({ create: true, name: "Mrs. Hale" });
    expect(titleCase("O'BRIEN")).toBe("O'Brien");
  });
});

describe("a picker with nothing to offer", () => {
  it("says what typing a name does, when the cast is empty and nothing is typed", () => {
    expect(suggest("line", "", [])).toEqual([]);
    expect(emptyPrompt("line", "", 0)).toBe("Type a name to add someone to the story");
    expect(emptyPrompt("mention", "", 0)).toBe("Type a name to add someone to the story");
    expect(emptyPrompt("place", "", 0)).toBe("Type a name to add a place to the story");
  });

  it("stays quiet once there are names, or a typed name is offered as new", () => {
    expect(emptyPrompt("line", "", suggest("line", "", ENTRIES).length)).toBeNull();
    expect(suggest("line", "Ma", [])).toHaveLength(1);
    expect(emptyPrompt("line", "Ma", 1)).toBeNull();
  });
});
