import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Two characters speaking at once (doc 25, P8). The second speech's cue carries `data-dual`,
 * and the page prints the two side by side. In the editor it is "Speak at the same time" on a
 * line, from the palette, because `^` keeps its one meaning (D6); Fountain's `^` turns into it
 * only on paste and import.
 */

const SPEECH = new Set(["paren", "dialogue", "lyric"]);

/** The index of the cue whose speech holds block `index`, or null when it is in no speech. */
function cueOf(doc: PMNode, index: number): number | null {
  for (let i = index; i >= 0; i--) {
    const el = doc.child(i).attrs.el as string | null;
    if (el === "cue") return i;
    if (!el || !SPEECH.has(el)) return null;
  }
  return null;
}

/** Whether the speech at `cue` follows straight on from another speech, which it can be spoken with. */
function followsSpeech(doc: PMNode, cue: number): boolean {
  if (cue === 0) return false;
  const before = cueOf(doc, cue - 1);
  return before !== null && before !== cue - 1 && !doc.child(before).attrs.dual;
}

/**
 * Mark the speech the cursor is in as spoken at the same time as the one before it, or unmark
 * it. "none" when the cursor is in no speech, or the speech does not follow another.
 */
export function toggleDual(editor: Editor): "on" | "off" | "none" {
  const { state } = editor;
  const index = state.selection.$from.index(0);
  const cue = cueOf(state.doc, index);
  if (cue === null) return "none";
  const node = state.doc.child(cue);
  const on = !node.attrs.dual;
  if (on && !followsSpeech(state.doc, cue)) return "none";
  let pos = 0;
  for (let i = 0; i < cue; i++) pos += state.doc.child(i).nodeSize;
  editor.view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, dual: on }));
  return on ? "on" : "off";
}
