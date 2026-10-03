import { describe, expect, it } from "vitest";
import type { StoryStructureTemplate, StructureNode } from "../../types";
import { excerpt, proseParagraphs, sceneSequence } from "./sequence";

let pos = 0;
const node = (id: string, title: string, level: number, children: StructureNode[] = []) =>
  ({ id, title, level, position: pos++, status: "draft", word_count: 100, children }) as StructureNode;

const template = {
  levels: [{ name: "Act" }, { name: "Chapter" }, { name: "Scene" }],
  flat: false,
} as StoryStructureTemplate;

const structure = [
  node("a1", "Act 1", 0, [
    node("c3", "Chapter 3: Old Records", 1, [node("logbook", "The Logbook", 2), node("gap", "The Gap", 2)]),
    node("c4", "What the Storm Carries", 1, [node("night", "Night Passage", 2)]),
    node("c5", "", 1, [node("thomas", "What Thomas Knew", 2)]),
  ]),
];

describe("sceneSequence", () => {
  it("finds the scenes either side and names a chapter break", () => {
    const seq = sceneSequence(structure, template, "night")!;
    expect(seq.position).toBe(3);
    expect(seq.total).toBe(4);
    expect(seq.chapter).toBe("Chapter 2: What the Storm Carries");
    expect(seq.before?.node.id).toBe("gap");
    expect(seq.before?.chapterBreak).toBe("End of Chapter 3: Old Records");
    expect(seq.after?.node.id).toBe("thomas");
    expect(seq.after?.chapterBreak).toBe("Chapter 3 begins");
  });

  it("names no break inside a chapter", () => {
    const seq = sceneSequence(structure, template, "gap")!;
    expect(seq.before?.node.id).toBe("logbook");
    expect(seq.before?.chapterBreak).toBeNull();
  });

  it("has nothing past the story's edges", () => {
    expect(sceneSequence(structure, template, "logbook")!.before).toBeNull();
    expect(sceneSequence(structure, template, "thomas")!.after).toBeNull();
  });

  it("is null on a chapter's own page", () => {
    expect(sceneSequence(structure, template, "c4")).toBeNull();
  });
});

describe("proseParagraphs", () => {
  it("reads each paragraph as the reader sees it", () => {
    const html =
      "<p>The logs were kept by @Eleanor Vance in [[The Lighthouse]].</p>" +
      '<p>"I know."&lt;Calder&gt;</p><p></p><p>Line one<br>line two</p>';
    expect(proseParagraphs(html)).toEqual([
      "The logs were kept by Eleanor Vance in The Lighthouse.",
      '"I know."',
      "Line one\nline two",
    ]);
  });

  it("is empty for a scene with no prose", () => {
    expect(proseParagraphs(null)).toEqual([]);
    expect(proseParagraphs("<p></p>")).toEqual([]);
  });

  it("takes the last paragraphs before and the first after", () => {
    const ps = ["a", "b", "c", "d"];
    expect(excerpt(ps, 3, "end")).toEqual(["b", "c", "d"]);
    expect(excerpt(ps, 1, "start")).toEqual(["a"]);
    expect(excerpt(ps, 6, "end")).toEqual(ps);
  });
});
