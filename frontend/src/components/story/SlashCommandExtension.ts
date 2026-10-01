/**
 * SlashCommandExtension — in-editor slash command picker.
 *
 * Typing `/` at the start of a word opens a floating picker showing
 * available commands. Arrow keys navigate, Tab or Enter executes,
 * Escape dismisses.
 *
 * The plugin is read-only (it never dispatches transactions). Execution
 * happens via keyboard-shortcut handlers, which are safe to dispatch from.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// ---------------------------------------------------------------------------
// Command registry
// ---------------------------------------------------------------------------

export interface SlashCommandDef {
  name: string;
  label: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    name: "dialogue",
    label: "Insert dialogue line",
    description: "Insert a dialogue block with speaker attribution",
  },
  {
    name: "todo",
    label: "Add TODO",
    description: "Mark a TODO at the cursor position",
  },
];

// ---------------------------------------------------------------------------
// Module-level callbacks (safe: only one SceneEditor exists at a time)
// ---------------------------------------------------------------------------

export interface SlashCallbacks {
  /** Called whenever the picker should open or update its query/position */
  onOpen: (query: string, slashFrom: number, slashTo: number, bottom: number, left: number) => void;
  /** Called when the picker should close (no match / cursor moved away) */
  onClose: () => void;
  onArrowDown: () => void;
  onArrowUp: () => void;
  /** Execute selected command (from Enter or Tab shortcut handler) */
  onExecute: () => void;
}

let _isOpen = false;

const _cb: SlashCallbacks = {
  onOpen: () => {},
  onClose: () => {},
  onArrowDown: () => {},
  onArrowUp: () => {},
  onExecute: () => {},
};

/** Whether the slash picker is open (an Escape in the prose closes it first). */
export function slashIsOpen(): boolean {
  return _isOpen;
}

export function setSlashIsOpen(v: boolean) {
  _isOpen = v;
}

export function setSlashCallbacks(cb: Partial<SlashCallbacks>) {
  Object.assign(_cb, cb);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const slashTriggerKey = new PluginKey("slashCommandTrigger");

export const SlashCommandExtension = Extension.create({
  name: "slashCommands",

  // Keyboard handlers run outside of view.update — safe to dispatch here
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!_isOpen) return false;
        _cb.onExecute();
        return true;
      },
      Enter: () => {
        if (!_isOpen) return false;
        _cb.onExecute();
        return true;
      },
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
      Escape: () => {
        if (!_isOpen) return false;
        _cb.onClose();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: slashTriggerKey,
        view() {
          return {
            update(view, prevState) {
              const { state } = view;
              if (state.selection === prevState.selection && state.doc === prevState.doc) {
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

              // Match /word at start of a word (preceded by whitespace or start of line)
              const match = textBefore.match(/\/(\w*)$/);
              if (match) {
                const slashIdx = textBefore.length - match[0].length;
                const prevChar = slashIdx > 0 ? textBefore[slashIdx - 1] : null;
                if (prevChar === null || prevChar === " " || prevChar === "\t") {
                  const query = match[1].toLowerCase();
                  const slashFrom = blockStart + slashIdx;
                  const slashTo = from;

                  const matching = SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(query));

                  if (matching.length > 0) {
                    const coords = view.coordsAtPos(from);
                    _cb.onOpen(query, slashFrom, slashTo, coords.bottom, coords.left);
                    return;
                  }
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
