import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { findTextRange } from "./anchor";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
  marks: { em: {} },
});

const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [schema.text("The barometer had been falling.")]),
  schema.node("paragraph", null, [
    schema.text("The sea went "),
    schema.text("very still", [schema.mark("em")]),
    schema.text(", as if drawing a breath."),
  ]),
]);

describe("findTextRange", () => {
  it("finds words across marks in a later paragraph", () => {
    const r = findTextRange(doc, "very still, as if")!;
    expect(doc.textBetween(r.from, r.to)).toBe("very still, as if");
  });
  it("says so when the words have changed", () => {
    expect(findTextRange(doc, "went quiet")).toBeNull();
    expect(findTextRange(doc, "  ")).toBeNull();
  });
});
