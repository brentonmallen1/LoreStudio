import type { Editor } from "@tiptap/core";
import { mentionRanges } from "./otherNames";

/**
 * Drop the mention syntax around `name` in the open scene, keeping the words: "[[The
 * Cottage]]" becomes "The Cottage", "@Nell" becomes "Nell". One transaction, so ⌘Z puts
 * the links back. Returns how many it unlinked.
 */
export function unlinkMentions(editor: Editor, type: "character" | "setting", name: string): number {
  const found: { from: number; to: number; words: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const r of mentionRanges(node.text, type, name))
      found.push({ from: pos + r.from, to: pos + r.to, words: r.words });
  });
  if (!found.length) return 0;
  const tr = editor.state.tr;
  for (const r of found.reverse()) tr.insertText(r.words, r.from, r.to);
  editor.view.dispatch(tr);
  return found.length;
}
