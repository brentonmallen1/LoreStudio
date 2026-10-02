import type { Node as PMNode } from "@tiptap/pm/model";
import { forEachBlockText } from "../prose/blockText";

/**
 * Where some words are in a document (doc 15 polish): the first place a note's quoted
 * passage still reads the same, within one paragraph, so a note whose mark was lost (an
 * undone delete, a paste) can be marked again. Null when the words have changed.
 */
export function findTextRange(doc: PMNode, needle: string): { from: number; to: number } | null {
  const want = needle.trim();
  if (!want) return null;
  let found: { from: number; to: number } | null = null;
  forEachBlockText(doc, ({ text, range }) => {
    const i = found ? -1 : text.indexOf(want);
    if (i >= 0) found = range(i, i + want.length);
  });
  return found;
}
