import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * A paragraph's text as the reader sees it, with each character's document position.
 *
 * ProseMirror splits a paragraph's text wherever its marks change: italics, bold, a note's
 * highlight. Anything that reads the inline syntax ("…"<Name>, @Name, [[Place]]) one text
 * node at a time misses every match that crosses a mark, so a line like
 * "the <em>Ardent</em>."<Calder> lost its speaker. Read the block instead and map back.
 * A leaf inside the text (a line break, an image) reads as one separator character, so no
 * match runs across it.
 */
export interface BlockText {
  text: string;
  /** Document range of text[start, end). */
  range: (start: number, end: number) => { from: number; to: number };
}

export const LEAF = "￼";

export function blockText(block: PMNode, blockPos: number): BlockText {
  let text = "";
  const at: number[] = [];
  block.descendants((node, pos) => {
    const docPos = blockPos + 1 + pos;
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) at.push(docPos + i);
      text += node.text;
    } else if (node.isLeaf) {
      at.push(docPos);
      text += node.type.name === "hardBreak" ? "\n" : LEAF;
    }
  });
  return {
    text,
    range: (start, end) => ({ from: at[start], to: at[end - 1] + 1 }),
  };
}

/** Every textblock in the document, read whole. */
export function forEachBlockText(doc: PMNode, fn: (block: BlockText) => void): void {
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    fn(blockText(node, pos));
    return false;
  });
}
