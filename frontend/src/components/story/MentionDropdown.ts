import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export interface MentionItem {
  type: "character" | "setting" | "create";
  name: string;
  role?: string;
  /** Palette slot 1..8 (doc 11 P2), painted on the decoration as data-slot. */
  slot?: number;
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
/** The entity lit up in the prose (doc 11 P2): the one whose tab is open or hovered. */
let _highlightName: string | null = null;
export function setMentionHighlight(name: string | null): void {
  _highlightName = name;
}

const _cb: MentionCallbacks = {
  onOpen: () => {},
  onClose: () => {},
  onArrowDown: () => {},
  onArrowUp: () => {},
  onEnterSelect: () => {},
};

// Dialogue-mode callbacks — called when @@ trigger is detected instead of @
let _dialogueMode = false;
let _onDialogueOpen: ((query: string, bottom: number, left: number) => void) | null = null;
let _onDialogueClose: (() => void) | null = null;

export function setMentionDialogueCallbacks(
  onOpen: (query: string, bottom: number, left: number) => void,
  onClose: () => void,
) {
  _onDialogueOpen = onOpen;
  _onDialogueClose = onClose;
}

// Attribution-mode callbacks — called when < after a closing quote is detected
let _attributionMode = false;
let _onAttributionOpen: ((query: string, bottom: number, left: number) => void) | null = null;
let _onAttributionClose: (() => void) | null = null;

export function setMentionAttributionCallbacks(
  onOpen: (query: string, bottom: number, left: number) => void,
  onClose: () => void,
) {
  _onAttributionOpen = onOpen;
  _onAttributionClose = onClose;
}

export function isMentionAttributionMode(): boolean {
  return _attributionMode;
}

export const FORCE_MENTION_KEY = "forceMentionRebuild";

/** Whether the @-mention picker is open (an Escape in the prose closes it first). */
export function mentionIsOpen(): boolean {
  return _isOpen;
}

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
  const chars = _items.filter((i) => i.type === "character");
  const settings = _items.filter((i) => i.type === "setting");

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const claimedRanges: Array<[number, number]> = [];

    // Known character mentions — exact name match
    for (const char of chars) {
      const re = new RegExp(`@${escapeRe(char.name)}(?=[\\s.,;:!?)"'\\]]|$)`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const from = pos + m.index;
        const to = from + m[0].length;
        claimedRanges.push([from, to]);
        decos.push(
          Decoration.inline(
            from,
            to,
            {
              class: char.name === _highlightName ? "mention-char mention-hl" : "mention-char",
              "data-mention-name": char.name,
              "data-mention-type": "character",
              ...(char.slot ? { "data-slot": String(char.slot) } : {}),
            },
            MENTION_SPEC,
          ),
          ...syntaxDecos(from, to, "character"),
        );
      }
    }

    // Known setting mentions — exact name match
    for (const setting of settings) {
      const re = new RegExp(`\\[\\[${escapeRe(setting.name)}\\]\\]`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const from = pos + m.index;
        const to = from + m[0].length;
        claimedRanges.push([from, to]);
        decos.push(
          Decoration.inline(
            from,
            to,
            {
              class: setting.name === _highlightName ? "mention-setting mention-hl" : "mention-setting",
              "data-mention-name": setting.name,
              "data-mention-type": "setting",
              ...(setting.slot ? { "data-slot": String(setting.slot) } : {}),
            },
            MENTION_SPEC,
          ),
          ...syntaxDecos(from, to, "setting"),
        );
      }
    }

    function isClaimed(from: number, to: number): boolean {
      return claimedRanges.some(([a, b]) => from < b && to > a);
    }

    // Unknown @Name mentions (not matched by any known character)
    const unknownCharRe = /@([A-Za-z]\S*)(?=[\s.,;:!?)"'\]]|$)/g;
    let mu: RegExpExecArray | null;
    while ((mu = unknownCharRe.exec(text)) !== null) {
      const from = pos + mu.index;
      const to = from + mu[0].length;
      if (!isClaimed(from, to)) {
        decos.push(
          Decoration.inline(
            from,
            to,
            {
              class: "mention-missing",
              "data-mention-name": mu[1],
              "data-mention-type": "character",
            },
            MENTION_SPEC,
          ),
          ...syntaxDecos(from, to, "character"),
        );
      }
    }

    // Unknown [[Setting]] mentions (not matched by any known setting)
    const unknownSettingRe = /\[\[([^\]]+)\]\]/g;
    let ms: RegExpExecArray | null;
    while ((ms = unknownSettingRe.exec(text)) !== null) {
      const from = pos + ms.index;
      const to = from + ms[0].length;
      if (!isClaimed(from, to)) {
        decos.push(
          Decoration.inline(
            from,
            to,
            {
              class: "mention-missing",
              "data-mention-name": ms[1],
              "data-mention-type": "setting",
            },
            MENTION_SPEC,
          ),
          ...syntaxDecos(from, to, "setting"),
        );
      }
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

      // Trigger detection — watches text before cursor for @query pattern
      new Plugin({
        key: mentionTriggerKey,
        view() {
          return {
            update(view, prevState) {
              const { state } = view;
              // Only react to actual selection or document changes
              if (state.selection === prevState.selection && state.doc === prevState.doc) {
                return;
              }
              // Moving the cursor is not asking for a name. Clicking into "@Eleanor Vance"
              // used to open the picker as if "@Eleanor" were being typed.
              if (state.doc === prevState.doc) {
                _cb.onClose();
                return;
              }

              const { from, empty } = state.selection;
              if (!empty) {
                _cb.onClose();
                return;
              }

              const $from = state.doc.resolve(from);
              const blockStart = $from.start();
              const textBefore = state.doc.textBetween(blockStart, from, "\n", "\0");

              // Check for ^ (dialogue mode trigger) — completely separate from @
              const dialogueMatch = textBefore.match(/\^(\S*)$/);
              if (dialogueMatch) {
                const atIdx = textBefore.length - dialogueMatch[0].length;
                const prevChar = atIdx > 0 ? textBefore[atIdx - 1] : null;
                if (prevChar === null || prevChar === " " || prevChar === "\t") {
                  _dialogueMode = true;
                  const coords = view.coordsAtPos(from);
                  _onDialogueOpen?.(dialogueMatch[1], coords.bottom, coords.left);
                  return;
                }
              }

              // Check for @query at end — must be preceded by whitespace or start of block
              const match = textBefore.match(/@(\S*)$/);
              if (match) {
                const atIdx = textBefore.length - match[0].length;
                const prevChar = atIdx > 0 ? textBefore[atIdx - 1] : null;
                if (prevChar === null || prevChar === " " || prevChar === "\t") {
                  if (_dialogueMode) {
                    _dialogueMode = false;
                    _onDialogueClose?.();
                  }
                  const coords = view.coordsAtPos(from);
                  _cb.onOpen(match[1], coords.bottom, coords.left);
                  return;
                }
              }

              // Check for < after a closing quote (attribution mode)
              const attrMatch = textBefore.match(/[""\u201d]<([^>]*)$/);
              if (attrMatch) {
                if (!_attributionMode) {
                  _attributionMode = true;
                }
                const coords = view.coordsAtPos(from);
                _onAttributionOpen?.(attrMatch[1], coords.bottom, coords.left);
                return;
              }

              if (_attributionMode) {
                _attributionMode = false;
                _onAttributionClose?.();
              }

              if (_dialogueMode) {
                _dialogueMode = false;
                _onDialogueClose?.();
              }
              _cb.onClose();
            },
          };
        },
      }),
    ];
  },
});
