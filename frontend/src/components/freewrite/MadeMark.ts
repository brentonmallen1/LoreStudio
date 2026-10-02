import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Words on the Freewrite page that became something (doc 15 N3): `ref` says what, as
 * "note:<id>", "character:<id>", "place:<id>", "scene:<id>", "theme:<name>", or the field
 * it went into ("logline", "premise", "conflict"). The text stays where it was written.
 */
export const MadeMark = Mark.create({
  name: "made",
  inclusive: false,
  addAttributes() {
    return {
      ref: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-made"),
        renderHTML: (attrs) => ({ "data-made": attrs.ref }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-made]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "made" }), 0];
  },
});
