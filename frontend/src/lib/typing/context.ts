import type { EditorState } from "@tiptap/pm/state";
import type { StoryFormat } from "../../types";
import { HELPERS, helpersFor, type HelperContext, type HelperId, type TypingHelper } from "./helpers";

/**
 * What you can type where the cursor is (doc 26, P3): the places in the text a helper works,
 * read from the editor, and the helpers for them in the order the status corner lists them.
 */

/** The contexts the cursor is in; "anywhere" always. */
export function contextsAt(state: EditorState, format: StoryFormat): HelperContext[] {
  const out: HelperContext[] = ["anywhere"];
  const { selection } = state;
  if (!selection.empty) return [...out, "selection"];
  const { $from } = selection;
  const block = $from.parent;
  if (!block.isTextblock) return out;
  const before = block.textBetween(0, $from.parentOffset, "\n", " ");
  const atEnd = $from.parentOffset === block.content.size;
  if (format === "prose") {
    // Straight after a closing quote mark: curly, or a straight one that closes a pair.
    if (/”$/.test(before) || (/"$/.test(before) && (before.match(/"/g) ?? []).length % 2 === 0))
      out.push("after-quote");
    return out;
  }
  const el = (block.attrs.el as string | null) ?? "action";
  if (el === "cue") out.push("in-cue");
  if ((el === "dialogue" || el === "paren") && !block.content.size) out.push("in-speech");
  if (el === "action" && !before.trim()) out.push("line-start");
  if (atEnd && before.trim()) out.push("line-end");
  return out;
}

/** In a script the keys card says what Enter, Tab, ⌥⌘1–6, ^ and / do from the line. */
const IN_KEYS_CARD = new Set<string>(["script-enter", "script-tab", "script-keys", "line", "slash"]);

/**
 * The helpers for these contexts: those for this exact spot first, then the ones that work
 * anywhere; within each, the ones not yet used first. A script leaves out what its keys card
 * says.
 */
export function helpersHere(
  format: StoryFormat,
  contexts: HelperContext[],
  used: ReadonlySet<HelperId>,
): TypingHelper[] {
  const rank = (h: TypingHelper) => (h.context === "anywhere" ? 2 : 0) + (used.has(h.id as HelperId) ? 1 : 0);
  const order = new Map(HELPERS.map((h, i) => [h.id as string, i]));
  return helpersFor(format)
    .filter((h) => contexts.includes(h.context) && !(format !== "prose" && IN_KEYS_CARD.has(h.id)))
    .sort((a, b) => rank(a) - rank(b) || order.get(a.id)! - order.get(b.id)!);
}
