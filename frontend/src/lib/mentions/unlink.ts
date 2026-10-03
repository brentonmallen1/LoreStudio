import type { Editor } from "@tiptap/core";
import { forEachBlockText } from "../prose/blockText";
import { findMentions, foldName, type Lexicon } from "../prose/syntax";

/**
 * Drop the syntax around a mention that names nobody, in the open scene, keeping the words:
 * "[[The Old Boathouse]]" becomes "The Old Boathouse", "@Nell" becomes "Nell". `lexicon` is
 * what the editor resolves mentions by, so a known "@Nell Vance" is left alone when "@Nell"
 * is unlinked. One transaction, so ⌘Z puts the links back. Returns how many it unlinked.
 */
export function unlinkMentions(
  editor: Editor,
  type: "character" | "setting",
  written: string,
  lexicon: Lexicon,
): number {
  const kind = type === "character" ? "character" : "place";
  const want = foldName(written);
  const found: { from: number; to: number; words: string }[] = [];
  forEachBlockText(editor.state.doc, ({ text, range }) => {
    for (const m of findMentions(text, lexicon))
      if (m.kind === kind && !m.name && foldName(m.written) === want)
        found.push({
          ...range(m.start, m.end),
          words: text.slice(m.start, m.end).replace(/^@|^\[\[|\]\]$/g, ""),
        });
  });
  if (!found.length) return 0;
  const tr = editor.state.tr;
  for (const r of found.reverse()) tr.insertText(r.words, r.from, r.to);
  editor.view.dispatch(tr);
  return found.length;
}
