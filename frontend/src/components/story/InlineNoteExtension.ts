import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface InlineNoteCallbacks {
  onNoteActivate: (noteId: string, rect: DOMRect) => void;
  onAddNote: (from: number, to: number, anchor: string) => void;
}

// Module-level callbacks — safe since only one SceneEditor exists at a time.
const _cb: InlineNoteCallbacks = {
  onNoteActivate: () => {},
  onAddNote: () => {},
};

export function setInlineNoteCallbacks(cb: Partial<InlineNoteCallbacks>) {
  if (cb.onNoteActivate !== undefined) _cb.onNoteActivate = cb.onNoteActivate;
  if (cb.onAddNote !== undefined) _cb.onAddNote = cb.onAddNote;
}

const clickKey = new PluginKey("noteClick");

export const InlineNoteExtension = Mark.create({
  name: "inlineNote",

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-note-id"),
        renderHTML: (attrs) => ({ "data-note-id": attrs.noteId }),
      },
      noteType: {
        default: "author",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-note-type") ?? "author",
        renderHTML: (attrs) => ({ "data-note-type": attrs.noteType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-note-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const isEditorial = HTMLAttributes["data-note-type"] === "editorial";
    const cls = isEditorial ? "note-anchor note-anchor--editorial" : "note-anchor";
    return ["span", mergeAttributes(HTMLAttributes, { class: cls }), 0];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-n": () => {
        const { from, to, empty } = this.editor.state.selection;
        if (!empty) {
          const anchor = this.editor.state.doc.textBetween(from, to);
          _cb.onAddNote(from, to, anchor);
          return true;
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: clickKey,
        props: {
          // A click on the noted words opens the note's card in the margin (doc 13 P2).
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            const noteEl = target.closest(".note-anchor[data-note-id]") as HTMLElement | null;
            if (noteEl?.dataset.noteId) {
              _cb.onNoteActivate(noteEl.dataset.noteId, noteEl.getBoundingClientRect());
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
