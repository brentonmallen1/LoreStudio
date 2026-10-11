import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { StoryFormat } from "../../types";
import { cueName } from "../script/syntax";

/**
 * The one place a spoken line is written (doc 25, D6). The author asks for a line the same
 * way in prose and in a script (`^` or /dialogue for a new one, `<` after a quote, Attribute
 * on a selection), and the story's format decides what lands:
 *
 *   prose       "It's still burning."<Eleanor>
 *   screenplay  ELEANOR                         (a cue block)
 *               It's still burning.             (a dialogue block)
 *
 * In a script the words keep their marks: the block is split around them rather than
 * retyped, so italics in a line survive becoming dialogue.
 */
export interface SpokenLine {
  /**
   * "line": `^` (and whatever followed it) at from..to asks for a new, empty line.
   * "wrap": the selection from..to becomes the line.
   * "tag": `<` was typed after a closing quote; from..to is the speaker typed after it.
   */
  kind: "line" | "wrap" | "tag";
  from: number;
  to: number;
  /** The speaker as the author chose to write them ("Eleanor", "Nell"). */
  speaker: string;
  /** The story's quote marks, for prose. */
  quotes: [string, string];
}

const OPENING = /^["“‘']/;
const CLOSING = /["”’']$/;
/** The quote just before a typed `<`: its words, closed, maybe a space, then the `<`. */
const QUOTE_BEFORE_TAG = new RegExp('[“"‘\']([^“”"]+)[”"’\'][ \\u00a0]?<$');

export function writeSpokenLine(tr: Transaction, format: StoryFormat, line: SpokenLine): void {
  if (format === "prose") return writeProse(tr, line);
  const { from, to, speaker } = line;
  if (line.kind === "line") {
    tr.delete(from, to);
    toSpeech(tr, from, from, speaker);
  } else if (line.kind === "wrap") {
    // Quote marks around the selection were the prose's way of saying it is spoken.
    let end = to;
    if (CLOSING.test(tr.doc.textBetween(end - 1, end))) {
      tr.delete(end - 1, end);
      end -= 1;
    }
    if (OPENING.test(tr.doc.textBetween(from, from + 1))) {
      tr.delete(from, from + 1);
      end -= 1;
    }
    toSpeech(tr, from, end, speaker);
  } else {
    // The `<` sits just before `from`; the quote before it becomes the dialogue.
    const start = tr.doc.resolve(from).start();
    const before = tr.doc.textBetween(start, from, "\n", "￼");
    const quote = QUOTE_BEFORE_TAG.exec(before);
    if (!quote) return writeProse(tr, line);
    const open = start + quote.index;
    const wordsEnd = open + 1 + quote[1].length;
    tr.delete(wordsEnd, to);
    tr.delete(open, open + 1);
    toSpeech(tr, open, wordsEnd - 1, speaker);
  }
}

function writeProse(tr: Transaction, { kind, from, to, speaker, quotes: [open, close] }: SpokenLine): void {
  if (kind === "line") {
    tr.insertText(`${open}${close}<${speaker}>`, from, to);
    tr.setSelection(TextSelection.create(tr.doc, from + 1));
  } else if (kind === "wrap") {
    // Quote marks go around the selection, so its italics stay.
    const text = tr.doc.textBetween(from, to);
    tr.insertText(`${CLOSING.test(text) ? "" : close}<${speaker}>`, to);
    if (!OPENING.test(text)) tr.insertText(open, from);
  } else {
    tr.insertText(`${speaker}>`, from, to);
  }
}

/**
 * Make from..to (inside one paragraph) a speech: whatever was before it stays where it
 * was, a cue for the speaker goes above the words, the words become dialogue, and what
 * followed becomes action after them. The cursor ends at the end of the dialogue.
 */
export function toSpeech(tr: Transaction, from: number, to: number, speaker: string): void {
  const $from = tr.doc.resolve(from);
  const para = $from.parent;
  const start = $from.start();
  to = Math.min(to, $from.end());
  const text = (a: number, b: number) => tr.doc.textBetween(a, b, "\n", "￼");

  // Spaces between the line and what is around it go: they belonged to the prose.
  const after = text(to, $from.end());
  const trailing = after.length - after.trimStart().length;
  if (trailing) tr.delete(to, to + trailing);
  if (to < tr.doc.resolve(from).end())
    tr.split(to, 1, [{ type: para.type, attrs: { ...para.attrs, el: "action" } }]);

  const before = text(start, from);
  const leading = before.length - before.trimEnd().length;
  if (leading) {
    tr.delete(from - leading, from);
    from -= leading;
  }
  let at: number;
  if (from > start) {
    tr.split(from, 1, [{ type: para.type, attrs: { ...para.attrs, el: "dialogue" } }]);
    at = from + 1;
  } else {
    at = start - 1;
    tr.setNodeMarkup(at, undefined, { ...para.attrs, el: "dialogue" });
  }
  const name = cueName(speaker);
  const cue = para.type.create({ ...para.attrs, el: "cue" }, name ? tr.doc.type.schema.text(name) : null);
  tr.insert(at, cue);
  const dialogue = tr.doc.nodeAt(at + cue.nodeSize);
  const end = at + cue.nodeSize + 1 + (dialogue?.content.size ?? 0);
  tr.setSelection(TextSelection.create(tr.doc, end));
}
