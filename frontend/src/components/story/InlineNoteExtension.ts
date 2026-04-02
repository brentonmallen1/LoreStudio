import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

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

function buildGutterDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    let firstNoteId: string | null = null;
    node.forEach((inline) => {
      if (!firstNoteId) {
        const m = inline.marks.find((mk) => mk.type.name === "inlineNote");
        if (m) firstNoteId = m.attrs.noteId as string;
      }
    });
    if (firstNoteId) {
      const noteId = firstNoteId;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "note-gutter-marker";
      el.setAttribute("aria-label", "View note");
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        _cb.onNoteActivate(noteId, el.getBoundingClientRect());
      });
      decos.push(
        Decoration.widget(pos + 1, el, { side: -1, key: `g:${pos}` })
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

const gutterKey = new PluginKey<DecorationSet>("noteGutter");

export const InlineNoteExtension = Mark.create({
  name: "inlineNote",

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-note-id"),
        renderHTML: (attrs) => ({
          "data-note-id": attrs.noteId,
          class: "note-anchor",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-note-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
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
        key: gutterKey,
        state: {
          init: (_, state) => buildGutterDecos(state.doc),
          apply: (tr, old) =>
            tr.docChanged
              ? buildGutterDecos(tr.doc)
              : old.map(tr.mapping, tr.doc),
        },
        props: {
          decorations: (state) => gutterKey.getState(state),
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            const noteEl = target.closest(
              ".note-anchor[data-note-id]"
            ) as HTMLElement | null;
            if (noteEl?.dataset.noteId) {
              _cb.onNoteActivate(
                noteEl.dataset.noteId,
                noteEl.getBoundingClientRect()
              );
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
