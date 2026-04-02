import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export interface MentionItem {
  type: "character" | "setting";
  name: string;
  role?: string;
}

export interface MentionCallbacks {
  onOpen: (query: string, bottom: number, left: number) => void;
  onClose: () => void;
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnterSelect: () => void;
}

// Module-level state — safe since only one SceneEditor exists at a time.
let _isOpen = false;
let _items: MentionItem[] = [];

const _cb: MentionCallbacks = {
  onOpen: () => {},
  onClose: () => {},
  onArrowDown: () => {},
  onArrowUp: () => {},
  onEnterSelect: () => {},
};

export const FORCE_MENTION_KEY = "forceMentionRebuild";

export function setMentionIsOpen(open: boolean) {
  _isOpen = open;
}

export function setMentionItems(items: MentionItem[]) {
  _items = items;
}

export function setMentionCallbacks(cb: Partial<MentionCallbacks>) {
  Object.assign(_cb, cb);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  const chars = _items.filter((i) => i.type === "character");
  const settings = _items.filter((i) => i.type === "setting");

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;

    for (const char of chars) {
      // Match @Name followed by end-of-node, whitespace, or punctuation
      const re = new RegExp(
        `@${escapeRe(char.name)}(?=[\\s.,;:!?)"'\\]]|$)`,
        "g"
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        decos.push(
          Decoration.inline(pos + m.index, pos + m.index + m[0].length, {
            class: "mention-char",
          })
        );
      }
    }

    for (const setting of settings) {
      const re = new RegExp(`\\[\\[${escapeRe(setting.name)}\\]\\]`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        decos.push(
          Decoration.inline(pos + m.index, pos + m.index + m[0].length, {
            class: "mention-setting",
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decos);
}

const mentionDecoKey = new PluginKey<DecorationSet>("mentionDecos");
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
        _cb.onEnterSelect();
        return true;
      },
      Escape: () => {
        if (!_isOpen) return false;
        _cb.onClose();
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

      // Trigger detection — watches text before cursor for @query pattern
      new Plugin({
        key: mentionTriggerKey,
        view() {
          return {
            update(view, prevState) {
              const { state } = view;
              // Only react to actual selection or document changes
              if (
                state.selection === prevState.selection &&
                state.doc === prevState.doc
              ) {
                return;
              }

              const { from, empty } = state.selection;
              if (!empty) {
                _cb.onClose();
                return;
              }

              const $from = state.doc.resolve(from);
              const blockStart = $from.start();
              const textBefore = state.doc.textBetween(
                blockStart,
                from,
                "\n",
                "\0"
              );

              // Check for @query at end — must be preceded by whitespace or start of block
              const match = textBefore.match(/@(\S*)$/);
              if (match) {
                const atIdx = textBefore.length - match[0].length;
                const prevChar = atIdx > 0 ? textBefore[atIdx - 1] : null;
                if (prevChar === null || prevChar === " " || prevChar === "\t") {
                  const coords = view.coordsAtPos(from);
                  _cb.onOpen(match[1], coords.bottom, coords.left);
                  return;
                }
              }

              _cb.onClose();
            },
          };
        },
      }),
    ];
  },
});
