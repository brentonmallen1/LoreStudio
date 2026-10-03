import type { Editor } from "@tiptap/core";
import { forEachBlockText } from "../prose/blockText";
import { findMentions, findSpeakerTags, foldName, speakerName, type Lexicon } from "../prose/syntax";

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

/**
 * Take off the speaker tags that name `written` when it names nobody, in the open scene,
 * keeping the lines: "“No.”<Caldre>" becomes "“No.”". One transaction, so ⌘Z restores them.
 */
export function removeSpeakerTags(editor: Editor, written: string, lexicon: Lexicon): number {
  const want = foldName(written);
  const found: { from: number; to: number }[] = [];
  forEachBlockText(editor.state.doc, ({ text, range }) => {
    for (const t of findSpeakerTags(text))
      if (!speakerName(lexicon, t.speaker) && foldName(t.speaker) === want)
        found.push(range(t.tagStart, t.end));
  });
  if (!found.length) return 0;
  const tr = editor.state.tr;
  for (const r of found.reverse()) tr.delete(r.from, r.to);
  editor.view.dispatch(tr);
  return found.length;
}

/**
 * Point the speaker tags that say `written` (and name nobody) at `name` instead, in the open
 * scene: "“No.”<Caldre>" becomes "“No.”<The Visitor (Calder)>". A tag is markup, not the
 * author's words, so it is corrected rather than given another name. ⌘Z undoes it.
 */
export function retagSpeakers(editor: Editor, written: string, name: string, lexicon: Lexicon): number {
  const want = foldName(written);
  const found: { from: number; to: number }[] = [];
  forEachBlockText(editor.state.doc, ({ text, range }) => {
    for (const t of findSpeakerTags(text))
      if (!speakerName(lexicon, t.speaker) && foldName(t.speaker) === want)
        found.push(range(t.tagStart, t.end));
  });
  if (!found.length) return 0;
  const tr = editor.state.tr;
  for (const r of found.reverse()) tr.insertText(`<${name}>`, r.from, r.to);
  editor.view.dispatch(tr);
  return found.length;
}
