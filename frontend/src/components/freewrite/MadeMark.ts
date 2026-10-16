import { Mark, mergeAttributes, type Editor } from "@tiptap/core";

/**
 * Words on the Freewrite page that became something (doc 15 N3): `ref` says what, as
 * "note:<id>", "character:<id>", "place:<id>", "scene:<id>" (a planned scene), "draft:<id>"
 * (a scene started with these words), "idea:<id>" (the Outline's tray), "theme:<name>", or the field
 * it went into ("logline", "premise", "conflict"). The text stays where it was written.
 *
 * The same words can become more than one thing (a question, then a scene): marks of this kind
 * do not exclude one another, so making something from words already made into something keeps
 * both, nested or overlapping, and Made from this page lists each.
 */
export const MadeMark = Mark.create({
  name: "made",
  inclusive: false,
  excludes: "",
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

/**
 * Mark words as made into `ref`, beside whatever they were already made into. Not Tiptap's
 * `setMark`, which folds a mark of the same kind already there into the new one: the earlier
 * thing's mark would be overwritten and drop out of Made from this page.
 */
export function markMade(editor: Editor, from: number, to: number, ref: string): void {
  const type = editor.schema.marks.made;
  editor.view.dispatch(editor.state.tr.addMark(from, to, type.create({ ref })));
}

/** Every ref the page's marks carry, in the order they appear. */
export function refsIn(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    for (const m of node.marks)
      if (m.type.name === "made" && m.attrs.ref && !out.includes(m.attrs.ref)) out.push(m.attrs.ref);
  });
  return out;
}
