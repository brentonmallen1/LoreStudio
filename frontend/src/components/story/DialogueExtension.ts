/**
 * DialogueExtension — TipTap extension for dialogue markup.
 *
 * Highlights dialogue inline in the prose editor (doc 16):
 *   - Tagged:       "dialogue"<Name>  →  tinted quote and the tag, which a hover explains
 *   - Inferred:     the server named the speaker ("…," Eleanor said)  →  lighter tint
 *   - Unattributed: the server could not tell who speaks  →  amber
 *
 * Also handles ^ trigger for dialogue-mode insertion:
 * typing ^ opens the mention dropdown in dialogue mode, and selecting
 * a character inserts `""<Name>` with cursor between quotes.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { forEachBlockText } from "../../lib/prose/blockText";
import { findQuotes, findSpeakerTags, foldName, speakerName } from "../../lib/prose/syntax";
import type { DialogueBlock } from "../../types";
import { mentionLexicon } from "./MentionDropdown";

// ---------------------------------------------------------------------------
// Dialogue mode state (read by SceneEditor to change insertion behaviour)
// ---------------------------------------------------------------------------

let _dialogueModeActive = false;

export function isDialogueModeActive(): boolean {
  return _dialogueModeActive;
}

export function setDialogueModeActive(v: boolean) {
  _dialogueModeActive = v;
}

// Callbacks wired by SceneEditor for dialogue trigger handling
export interface DialogueCallbacks {
  onDialogueOpen: (query: string, bottom: number, left: number) => void;
  onDialogueClose: () => void;
}

const _dcb: DialogueCallbacks = {
  onDialogueOpen: () => {},
  onDialogueClose: () => {},
};

export function setDialogueCallbacks(cb: Partial<DialogueCallbacks>) {
  Object.assign(_dcb, cb);
}

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

const ATTRIBUTED = new Set(["inferred", "alternating", "manual", "pov_default", "explicit"]);

function buildDialogueDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
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
      decos.push(
        inline(t.quoteStart, t.quoteEnd, {
          class: "dialogue-explicit",
          "data-dialogue-speaker": who ?? t.speaker,
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
          ? inline(q.start, q.end, { class: "dialogue-inferred", "data-dialogue-speaker": line.speaker_name })
          : inline(q.start, q.end, { class: "dialogue-unattributed" }),
      );
    }
  });

  return DecorationSet.create(doc, decos);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const dialogueDecoKey = new PluginKey<DecorationSet>("dialogueDecos");

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
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => dialogueDecoKey.getState(state),
        },
      }),
    ];
  },
});
