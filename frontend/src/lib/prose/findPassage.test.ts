import { describe, expect, it } from "vitest";
import { Schema, type Node as PMNode } from "@tiptap/pm/model";
import { findPassage } from "./findPassage";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
  marks: { em: {} },
});

const para = (...parts: (string | [string])[]) =>
  schema.node(
    "paragraph",
    null,
    parts.map((p) => (typeof p === "string" ? schema.text(p) : schema.text(p[0], [schema.mark("em")]))),
  );

/** The words a found range covers, or null. */
function shown(doc: PMNode, passage: string): string | null {
  const r = findPassage(doc, passage);
  return r ? doc.textBetween(r.from, r.to) : null;
}

describe("findPassage", () => {
  const doc = schema.node("doc", null, [
    para(
      "Eleanor climbed the stairs to the lamp room as she had every night since the storm. Tomorrow the boat would come.",
    ),
    para("“My brother was the captain of the ", ["Ardent"], ".”<Calder> The words came out steady."),
    para("@Tom   waited by [[the keeper’s cottage]] until dark."),
  ]);

  it("finds a sentence across curly quotes, a mark and a speaker tag", () => {
    expect(shown(doc, '"My brother was the captain of the Ardent." The words came out')).toBe(
      "“My brother was the captain of the Ardent.”<Calder> The words came out",
    );
  });

  it("reads past the @ and [[ ]] the quote never had, and loose spaces", () => {
    expect(shown(doc, "Tom waited by the keeper's cottage")).toBe("Tom   waited by [[the keeper’s cottage");
  });

  it("prefers a whole word: Tom, not the Tom in Tomorrow", () => {
    const r = findPassage(doc, "Tom")!;
    expect(doc.textBetween(r.from, r.to)).toBe("Tom");
    expect(doc.resolve(r.from).parent.textContent).toContain("waited by");
  });

  it("drops an excerpt's ellipses and is not fussy about case", () => {
    expect(shown(doc, "…CLIMBED THE STAIRS to the lamp…")).toBe("climbed the stairs to the lamp");
  });

  it("finds a long quote by its opening once the end has been rewritten", () => {
    const long =
      "Eleanor climbed the stairs to the lamp room as she had every night since the storm. Tomorrow a ship came.";
    expect(shown(doc, long)).toBe(long.slice(0, 80));
  });

  it("gives up on words that are gone", () => {
    expect(findPassage(doc, "a sentence the author cut")).toBeNull();
    expect(findPassage(doc, "  …  ")).toBeNull();
  });
});
