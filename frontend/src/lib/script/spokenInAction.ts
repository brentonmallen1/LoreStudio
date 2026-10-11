import type { Transaction } from "@tiptap/pm/state";
import { toSpeech } from "../prose/writeLine";
import { findQuotes } from "../prose/syntax";

/**
 * A line written the prose way in a script's action (doc 25, D6): `"Run," Eleanor said.` or
 * `Eleanor said, "Run."`. The editor offers to make it Eleanor's line of dialogue, never does
 * it by itself. The same speech verbs the server reads tags by (dialogue_service._SPEECH_VERBS).
 */
const VERBS =
  "said|says|asked|asks|replied|answered|whispered|murmured|muttered|called|shouted|cried|" +
  "added|continued|began|repeated|admitted|explained|insisted|snapped|told|tells";

export interface SpokenInAction {
  /** The name as the action writes it ("Eleanor"). */
  speaker: string;
  /** The quote, marks included, as offsets in the block's text. */
  quoteStart: number;
  quoteEnd: number;
  /** The tag ("Eleanor said", with its comma or full stop), as offsets in the block's text. */
  tagStart: number;
  tagEnd: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The first quote in `text` tagged by one of `names` with a speech verb, before or after it. */
export function spokenInAction(text: string, names: string[]): SpokenInAction | null {
  const forms = [...new Set(names.filter((n) => n.trim()))].sort((a, b) => b.length - a.length);
  if (!forms.length) return null;
  const name = `(${forms.map(escape).join("|")})`;
  const after = new RegExp(`^\\s*(?:${name}\\s+(?:${VERBS})|(?:${VERBS})\\s+${name})\\b[.,]?`);
  const before = new RegExp(`(?:${name}\\s+(?:${VERBS})|(?:${VERBS})\\s+${name})\\s*[,:]?\\s*$`);
  for (const q of findQuotes(text)) {
    const tail = after.exec(text.slice(q.end));
    if (tail) {
      return {
        speaker: tail[1] ?? tail[2],
        quoteStart: q.start,
        quoteEnd: q.end,
        tagStart: q.end,
        tagEnd: q.end + tail[0].length,
      };
    }
    const head = before.exec(text.slice(0, q.start));
    if (head) {
      return {
        speaker: head[1] ?? head[2],
        quoteStart: q.start,
        quoteEnd: q.end,
        tagStart: head.index,
        tagEnd: q.start,
      };
    }
  }
  return null;
}

/**
 * Make the tagged quote in the block that starts at `base` (its first character's position) a
 * cue and its dialogue: the tag goes, the words lose their marks (a closing comma becomes a full
 * stop), and the action around them stays action. One transaction, so ⌘Z takes it back whole.
 */
export function makeItTheirLine(tr: Transaction, base: number, found: SpokenInAction): void {
  const { quoteStart, quoteEnd, tagStart, tagEnd, speaker } = found;
  const tagFirst = tagStart < quoteStart;
  tr.delete(base + tagStart, base + tagEnd);
  const shift = tagFirst ? tagEnd - tagStart : 0;
  const open = base + quoteStart - shift;
  let close = base + quoteEnd - shift - 1; // the closing mark
  tr.delete(close, close + 1);
  if (tr.doc.textBetween(close - 1, close) === ",") tr.insertText(".", close - 1, close);
  tr.delete(open, open + 1);
  close -= 1;
  toSpeech(tr, open, close, speaker);
}
