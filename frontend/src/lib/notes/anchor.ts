import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Where some words are in a document (doc 15 polish): the first place a note's quoted
 * passage still reads the same, within one paragraph, so a note whose mark was lost (an
 * undone delete, a paste) can be marked again. Null when the words have changed.
 */
export function findTextRange(doc: PMNode, needle: string): { from: number; to: number } | null {
  const want = needle.trim();
  if (!want) return null;
  let found: { from: number; to: number } | null = null;
  doc.descendants((block, blockPos) => {
    if (found) return false;
    if (!block.isTextblock) return true;
    // The block's text, and the document position of each of its characters.
    let text = "";
    const at: number[] = [];
    block.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      for (let i = 0; i < node.text.length; i++) at.push(blockPos + 1 + pos + i);
      text += node.text;
    });
    const i = text.indexOf(want);
    if (i >= 0) found = { from: at[i], to: at[i + want.length - 1] + 1 };
    return false;
  });
  return found;
}
