import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { forEachBlockText } from "../../lib/prose/blockText";
import { anyStartsWith, detectTrigger, type Entry, type Trigger } from "../../lib/prose/completion";
import { findMentions, makeLexicon, type Lexicon } from "../../lib/prose/syntax";

/**
 * Mentions in the prose (doc 16): their decorations, the picker's triggers and keys, and the
 * faint rest of a suggestion. What a picker offers and inserts is useMentionDropdown's.
 */
export interface MentionCallbacks {
  /** The text before the cursor asks for a picker (lib/prose/completion). */
  onTrigger: (trigger: Trigger, before: string, bottom: number, left: number) => void;
  onClose: () => void;
  onArrowDown: () => void;
  onArrowUp: () => void;
  /** Enter or Tab: take the chosen suggestion. */
  onAccept: () => void;
  /** Escape: close whatever picker is open. */
  onEscape: () => void;
}

// Module-level state — safe since only one SceneEditor exists at a time.
let _isOpen = false;
/** The entity lit up in the prose (doc 11 P2): the one whose tab is open or hovered. */
let _highlightName: string | null = null;
export function setMentionHighlight(name: string | null): void {
  _highlightName = name;
}

const _cb: MentionCallbacks = {
  onTrigger: () => {},
  onClose: () => {},
  onArrowDown: () => {},
  onArrowUp: () => {},
  onAccept: () => {},
  onEscape: () => {},
};

export const FORCE_MENTION_KEY = "forceMentionRebuild";
/** Meta on the transaction that redraws the faint suggestion (nothing else changes). */
export const GHOST_KEY = "mentionGhost";

/** Whether a picker is open (an Escape in the prose closes it first). */
export function mentionIsOpen(): boolean {
  return _isOpen;
}

export function setMentionIsOpen(open: boolean) {
  _isOpen = open;
}

let _entries: Entry[] = [];
let _lexicon: Lexicon = makeLexicon([]);
let _slots = new Map<string, number>();
let _ghost = "";

/** The story's characters and places, with their other names: what the prose may mention. */
export function setMentionEntries(entries: Entry[]) {
  _entries = entries;
  _slots = new Map(entries.filter((e) => e.slot).map((e) => [`${e.kind}:${e.name}`, e.slot!]));
  _lexicon = makeLexicon(entries);
}

/** The lexicon the decorations read, for anything else that has to agree with them. */
export function mentionLexicon(): Lexicon {
  return _lexicon;
}

/** The faint rest of the chosen suggestion, after the cursor; Tab takes it. */
export function setMentionGhost(text: string) {
  _ghost = text;
}

export function setMentionCallbacks(cb: Partial<MentionCallbacks>) {
  Object.assign(_cb, cb);
}

/** Spec on every mention decoration, so the reveal plugin can find the one at the cursor. */
const MENTION_SPEC = { mention: true };

/**
 * The syntax around a mention — the @ of a character, the [[ ]] of a setting — marked so
 * the editor can hide it while you write (SceneEditor.module.css, mention-syntax).
 */
function syntaxDecos(from: number, to: number, kind: "character" | "setting"): Decoration[] {
  if (kind === "character") return [Decoration.inline(from, from + 1, { class: "mention-syntax" })];
  return [
    Decoration.inline(from, from + 2, { class: "mention-syntax" }),
    Decoration.inline(to - 2, to, { class: "mention-syntax" }),
  ];
}

function buildMentionDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  // A paragraph at a time, by the one grammar (lib/prose/syntax): any capitals, any
  // apostrophe, other names; "@Nell," is Nell, and me@host.com is an address.
  forEachBlockText(doc, ({ text, range }) => {
    for (const m of findMentions(text, _lexicon)) {
      const { from, to } = range(m.start, m.end);
      const kind = m.kind === "character" ? "character" : "setting";
      const cls = !m.name ? "mention-missing" : kind === "character" ? "mention-char" : "mention-setting";
      const slot = m.name ? _slots.get(`${m.kind}:${m.name}`) : undefined;
      decos.push(
        Decoration.inline(
          from,
          to,
          {
            class: m.name && m.name === _highlightName ? `${cls} mention-hl` : cls,
            "data-mention-name": m.name ?? m.written,
            "data-mention-type": kind,
            ...(slot ? { "data-slot": String(slot) } : {}),
          },
          MENTION_SPEC,
        ),
        ...syntaxDecos(from, to, kind),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

const mentionDecoKey = new PluginKey<DecorationSet>("mentionDecos");
const mentionRevealKey = new PluginKey("mentionReveal");
const mentionTriggerKey = new PluginKey("mentionTrigger");

export const MentionDropdownExtension = Extension.create({
  name: "mentionDropdown",

  addKeyboardShortcuts() {
    return {
      ArrowDown: () => {
        if (!_isOpen) return false;
        _cb.onArrowDown();
        return true;
      },
      ArrowUp: () => {
        if (!_isOpen) return false;
        _cb.onArrowUp();
        return true;
      },
      Enter: () => {
        if (!_isOpen) return false;
        _cb.onAccept();
        return true;
      },
      Tab: () => {
        if (!_isOpen) return false;
        _cb.onAccept();
        return true;
      },
      Escape: () => {
        if (!_isOpen) return false;
        _cb.onEscape();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      // Decoration plugin — highlights existing @Name and [[Name]] in the prose
      new Plugin({
        key: mentionDecoKey,
        state: {
          init: (_, state) => buildMentionDecos(state.doc),
          apply: (tr, old) => {
            if (tr.docChanged || tr.getMeta(FORCE_MENTION_KEY)) {
              return buildMentionDecos(tr.doc);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => mentionDecoKey.getState(state),
        },
      }),

      // Reveal — the mention under the cursor shows its syntax, so it can be edited.
      // Cheap: it looks up the mentions already found at the cursor, nothing more.
      new Plugin({
        key: mentionRevealKey,
        props: {
          decorations: (state) => {
            const { from, to } = state.selection;
            const found = mentionDecoKey
              .getState(state)
              ?.find(from, to, (spec) => (spec as typeof MENTION_SPEC).mention === true);
            if (!found?.length) return null;
            return DecorationSet.create(
              state.doc,
              found.map((d) => Decoration.inline(d.from, d.to, { class: "mention-editing" })),
            );
          },
        },
      }),

      // The faint rest of a suggestion, just after the cursor.
      new Plugin({
        props: {
          decorations: (state) => {
            if (!_isOpen || !_ghost || !state.selection.empty) return null;
            const ghost = document.createElement("span");
            ghost.className = "mention-ghost";
            ghost.textContent = _ghost;
            return DecorationSet.create(state.doc, [
              Decoration.widget(state.selection.from, ghost, { side: 1, key: `ghost:${_ghost}` }),
            ]);
          },
        },
      }),

      // Triggers: the text before the cursor asks for a picker (lib/prose/completion).
      new Plugin({
        key: mentionTriggerKey,
        view() {
          return {
            update(view, prevState) {
              const { state } = view;
              if (state.selection === prevState.selection && state.doc === prevState.doc) return;
              // Moving the cursor is not asking for a name. Clicking into "@Eleanor Vance"
              // used to open the picker as if "@Eleanor" were being typed.
              if (state.doc === prevState.doc || !state.selection.empty) {
                _cb.onClose();
                return;
              }
              const { from } = state.selection;
              const before = state.doc.textBetween(state.doc.resolve(from).start(), from, "\n", "\0");
              const trigger = detectTrigger(before, (q) =>
                anyStartsWith(q, _entries, ["character", "place"]),
              );
              if (!trigger) {
                _cb.onClose();
                return;
              }
              const coords = view.coordsAtPos(from);
              _cb.onTrigger(trigger, before, coords.bottom, coords.left);
            },
          };
        },
      }),
    ];
  },
});
