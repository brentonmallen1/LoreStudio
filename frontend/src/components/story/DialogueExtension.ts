/**
 * DialogueExtension — TipTap extension for dialogue markup.
 *
 * Highlights attributed dialogue inline in the prose editor:
 *   - Explicit:     "dialogue"<Name>  →  speaker badge + tinted quote (includes <Name> suffix)
 *   - Inferred:     "dialogue" @Name said  →  lighter tint
 *   - Unattributed: "standalone quote"  →  amber warning
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
import { findSpeakerTags } from "../../lib/prose/syntax";

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
// Decoration patterns
// ---------------------------------------------------------------------------

function findInferredQuotes(text: string, explicitRanges: Array<[number, number]>): Array<[number, number]> {
  const results: Array<[number, number]> = [];

  function isClaimed(s: number, e: number): boolean {
    return explicitRanges.some(([a, b]) => s < b && e > a);
  }

  // Find all @mentions (single-word names only for inference)
  const mentionPositions: number[] = [];
  const mentionRe = /@[\w][\w'-]{0,49}/g;
  let mm: RegExpExecArray | null;
  while ((mm = mentionRe.exec(text)) !== null) {
    mentionPositions.push(mm.index);
  }

  if (mentionPositions.length === 0) return results;

  // Straight quotes (negative lookahead excludes "..."<Name> explicit syntax)
  const quoteRe = /(?:^|\s)"([^"]{2,})"(?!<)(?=\s|[.,;:!?]|$)/g;
  while ((mm = quoteRe.exec(text)) !== null) {
    const qStart = mm.index + (text[mm.index] === '"' ? 0 : 1);
    const qEnd = qStart + mm[0].trim().length;
    if (isClaimed(qStart, qEnd)) continue;
    // Check for nearby mention
    const nearMention = mentionPositions.some((mp) => Math.abs(qStart - mp) <= 150);
    if (nearMention) results.push([qStart, qEnd]);
  }
  return results;
}

function findUnattributedQuotes(
  text: string,
  claimedRanges: Array<[number, number]>,
): Array<[number, number]> {
  const results: Array<[number, number]> = [];
  function isClaimed(s: number, e: number): boolean {
    return claimedRanges.some(([a, b]) => s < b && e > a);
  }
  // Negative lookahead excludes "..."<Name> explicit syntax
  const quoteRe = /(?:^|\s)"([^"]{2,})"(?!<)(?=\s|[.,;:!?]|$)/g;
  let mm: RegExpExecArray | null;
  while ((mm = quoteRe.exec(text)) !== null) {
    const qStart = mm.index + (text[mm.index] === '"' ? 0 : 1);
    const qEnd = qStart + mm[0].trim().length;
    if (!isClaimed(qStart, qEnd)) results.push([qStart, qEnd]);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Build DecorationSet
// ---------------------------------------------------------------------------

const FORCE_DIALOGUE_KEY = "forceDialogueRebuild";

function buildDialogueDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];

  // A paragraph at a time, not a text node: a quote with an italic word in it is still
  // one quote (lib/prose/blockText).
  forEachBlockText(doc, ({ text, range }) => {
    const inline = (s: number, e: number, attrs: Record<string, string>) => {
      const r = range(s, e);
      return Decoration.inline(r.from, r.to, attrs);
    };

    // Tagged lines, by the one grammar (lib/prose/syntax): straight, curly or single
    // quotes, with or without a space before <Name>.
    const explicit = findSpeakerTags(text);
    const explicitRanges: Array<[number, number]> = explicit.map((t) => [t.quoteStart, t.end]);

    for (const t of explicit) {
      decos.push(
        inline(t.quoteStart, t.quoteEnd, { class: "dialogue-explicit", "data-dialogue-speaker": t.speaker }),
        inline(t.tagStart, t.end, { class: "dialogue-speaker-tag", "data-dialogue-speaker": t.speaker }),
      );
    }

    // Inferred (near @mention but not explicit)
    const inferred = findInferredQuotes(text, explicitRanges);
    const allClaimed = [...explicitRanges, ...inferred.map(([s, e]) => [s, e] as [number, number])];

    for (const [s, e] of inferred) {
      decos.push(
        inline(s, e, {
          class: "dialogue-inferred",
        }),
      );
    }

    // Unattributed (standalone quotes with no nearby mention)
    for (const [s, e] of findUnattributedQuotes(text, allClaimed)) {
      decos.push(
        inline(s, e, {
          class: "dialogue-unattributed",
        }),
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

export { FORCE_DIALOGUE_KEY };
