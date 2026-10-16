/**
 * DialogueExtension — TipTap extension for dialogue markup.
 *
 * Highlights dialogue inline in the prose editor (doc 16):
 *   - Tagged:       "dialogue"<Name>  →  tinted quote and the tag, which a hover explains
 *   - Inferred:     the server named the speaker ("…," Eleanor said)  →  lighter tint
 *   - Unattributed: the server could not tell who speaks  →  amber
 *
 * The pickers (^ for a new line, < after a quote for its speaker) are the mention
 * extension's (MentionDropdown.ts, lib/prose/completion).
 *
 * Two choices of the writer's (stores/proseViewStore) read these decorations through CSS on
 * `<html>`, so turning one on or off redraws nothing here:
 *   - a line with a speaker carries `data-speaker-slot`, their palette slot: with "Color
 *     dialogue by speaker" on it sits on that slot's tint, its words still ink;
 *   - with "Hide speaker tags" on, a named tag is hidden unless the caret touches its line,
 *     which the reveal plugin marks `dialogue-editing` (lib/prose/speakerTags).
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { forEachBlockText } from "../../lib/prose/blockText";
import { findQuotes, findSpeakerTags, foldName, speakerName } from "../../lib/prose/syntax";
import { revealedLines, type TaggedLine } from "../../lib/prose/speakerTags";
import type { DialogueBlock } from "../../types";
import { characterSlot, mentionLexicon } from "./MentionDropdown";

// ---------------------------------------------------------------------------
// Who says what (doc 16, D1)
// ---------------------------------------------------------------------------

// The scene's lines as the server read them (GET /scenes/{id}/dialogue, after each save).
// A tagged line is coloured from the prose itself, at once; an untagged one from these, so
// the prose, the Dialogue view, Numbers and Findings all say the same thing about it.
let _lines: DialogueBlock[] = [];

export const FORCE_DIALOGUE_KEY = "forceDialogueRebuild";

export function setSceneDialogue(lines: DialogueBlock[]) {
  _lines = lines.filter((l) => l.dialogue_type !== "thought");
}

/** Who the server thinks says a line with these words, if anyone: the speaker picker
 * offers them first. */
export function likelySpeaker(words: string): string | null {
  const key = foldName(words);
  const line = _lines.find((l) => foldName(l.content) === key && l.speaker_name);
  return line?.speaker_name ?? null;
}

const ATTRIBUTED = new Set(["inferred", "alternating", "manual", "pov_default", "explicit"]);

/** A line's speaker and their palette slot, as attributes (nothing when they have none). */
function speakerAttrs(name: string | null): Record<string, string> {
  const slot = name ? characterSlot(name) : undefined;
  return slot ? { "data-speaker-slot": String(slot) } : {};
}

interface DialogueState {
  set: DecorationSet;
  /** Every tagged line, in the document's positions, for the reveal plugin. */
  lines: TaggedLine[];
}

function buildDialogueDecos(doc: PMNode): DialogueState {
  const decos: Decoration[] = [];
  const lines: TaggedLine[] = [];
  const lexicon = mentionLexicon();
  // The server's untagged lines, by their words, in reading order: each quote takes the
  // first unclaimed line that says the same thing. A quote typed since the last save has
  // none yet and stays plain until it is saved.
  const pending = new Map<string, DialogueBlock[]>();
  for (const l of _lines) {
    const key = foldName(l.content);
    pending.set(key, [...(pending.get(key) ?? []), l]);
  }

  // A paragraph at a time, not a text node: a quote with an italic word in it is still
  // one quote (lib/prose/blockText).
  forEachBlockText(doc, ({ text, range }) => {
    const inline = (s: number, e: number, attrs: Record<string, string>) => {
      const r = range(s, e);
      return Decoration.inline(r.from, r.to, attrs);
    };

    // Tagged lines, by the one grammar (lib/prose/syntax): straight, curly or single
    // quotes, with or without a space before <Name>. The tag answers to a hover like a
    // mention; one that names nobody is marked, and the hover card can fix it.
    for (const t of findSpeakerTags(text)) {
      const who = speakerName(lexicon, t.speaker);
      const line = range(t.quoteStart, t.end);
      lines.push({ line, tag: range(t.tagStart, t.end), named: !!who });
      decos.push(
        inline(t.quoteStart, t.quoteEnd, {
          class: "dialogue-explicit",
          "data-dialogue-speaker": who ?? t.speaker,
          ...(who ? { "data-speaker-named": "" } : {}),
          ...speakerAttrs(who),
        }),
        inline(t.tagStart, t.end, {
          class: who ? "dialogue-speaker-tag" : "dialogue-speaker-tag speaker-missing",
          "data-dialogue-speaker": who ?? t.speaker,
          "data-mention-name": who ?? t.speaker,
          "data-mention-type": "character",
          "data-speaker-tag": "",
        }),
      );
    }

    for (const q of findQuotes(text)) {
      const line = pending.get(foldName(q.words))?.shift();
      if (!line) continue;
      decos.push(
        ATTRIBUTED.has(line.attribution_method) && line.speaker_name
          ? inline(q.start, q.end, {
              class: "dialogue-inferred",
              "data-dialogue-speaker": line.speaker_name,
              ...speakerAttrs(line.speaker_name),
            })
          : inline(q.start, q.end, { class: "dialogue-unattributed" }),
      );
    }
  });

  return { set: DecorationSet.create(doc, decos), lines };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const dialogueDecoKey = new PluginKey<DialogueState>("dialogueDecos");

export const DialogueExtension = Extension.create({
  name: "dialogueMarkup",

  addProseMirrorPlugins() {
    return [
      // Decoration plugin — highlights dialogue in editor
      new Plugin({
        key: dialogueDecoKey,
        state: {
          init: (_, state) => buildDialogueDecos(state.doc),
          apply: (tr, old) => {
            if (tr.docChanged || tr.getMeta(FORCE_DIALOGUE_KEY)) {
              return buildDialogueDecos(tr.doc);
            }
            return old;
          },
        },
        props: {
          decorations: (state) => dialogueDecoKey.getState(state)?.set,
        },
      }),

      // Reveal: the line the caret or selection touches is marked, so a hidden tag shows
      // while it can be edited (lib/prose/speakerTags). A look through the tagged lines,
      // nothing more; CSS hides the rest only while "Hide speaker tags" is on.
      new Plugin({
        props: {
          decorations: (state) => {
            const lines = dialogueDecoKey.getState(state)?.lines;
            if (!lines?.length) return null;
            const { from, to } = state.selection;
            const touched = revealedLines(lines, { from, to });
            if (!touched.length) return null;
            return DecorationSet.create(
              state.doc,
              touched.map((l) => Decoration.inline(l.line.from, l.line.to, { class: "dialogue-editing" })),
            );
          },
        },
      }),
    ];
  },
});
