import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { forEachBlockText, LEAF } from "./blockText";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    blockquote: { group: "block", content: "block+" },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true },
    image: { group: "inline", inline: true },
  },
  marks: { em: {} },
});

const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [
    schema.text('"My brother was the captain of the '),
    schema.text("Ardent", [schema.mark("em")]),
    schema.text('."<Calder> The words came out steady.'),
  ]),
  schema.node("blockquote", null, [
    schema.node("paragraph", null, [
      schema.text("One"),
      schema.node("hardBreak"),
      schema.text("two"),
      schema.node("image"),
      schema.text("three"),
    ]),
  ]),
]);

describe("blockText", () => {
  it("reads a paragraph whole, across marks, and maps a match back", () => {
    const blocks: string[] = [];
    let quote: { from: number; to: number } | null = null;
    forEachBlockText(doc, (b) => {
      blocks.push(b.text);
      const m = /"[^"]+"<[^>]+>/.exec(b.text);
      if (m) quote = b.range(m.index, m.index + m[0].length);
    });
    expect(blocks).toEqual([
      '"My brother was the captain of the Ardent."<Calder> The words came out steady.',
      `One\ntwo${LEAF}three`,
    ]);
    expect(doc.textBetween(quote!.from, quote!.to)).toBe(
      '"My brother was the captain of the Ardent."<Calder>',
    );
  });

  it("maps a range that ends on a leaf's neighbour", () => {
    forEachBlockText(doc, (b) => {
      const i = b.text.indexOf("two");
      if (i < 0) return;
      const r = b.range(i, i + 3);
      expect(doc.textBetween(r.from, r.to)).toBe("two");
    });
  });
});
