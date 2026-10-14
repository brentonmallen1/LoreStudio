import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { smartComplete } from "../../../lib/script/smartType";
import { CAPITALS, isElement } from "../../../lib/script/syntax";
import { useStoryStore } from "../../../stores/storyStore";
import { mentionIsOpen } from "../../story/MentionDropdown";
import { slashIsOpen } from "../../story/SlashCommandExtension";
import { markUsed } from "../../../stores/typingStore";

/**
 * SmartType for a script (doc 25, P3½; lib/script/smartType.ts): the rest of a heading's
 * INT./EXT., place or time, a transition or a cue's extension, faint after the cursor at the
 * end of the line. Tab takes it; with nothing offered, Tab switches the element as before.
 */
function offer(state: EditorState, format: string): string {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 1 || $from.parentOffset !== $from.parent.content.size) return "";
  const el = $from.parent.attrs.el;
  if (!isElement(el)) return "";
  const before = $from.parent.textBetween(0, $from.parentOffset, "\n", " ");
  const places = useStoryStore.getState().locations.map((l) => l.name);
  const found = smartComplete(el, before, format, places);
  return CAPITALS.includes(el) ? found.toUpperCase() : found;
}

function take(editor: Editor, format: string): boolean {
  if (mentionIsOpen() || slashIsOpen()) return false;
  const text = offer(editor.state, format);
  if (!text) return false;
  editor.view.dispatch(editor.state.tr.insertText(text));
  markUsed("smart-type");
  return true;
}

export const ScriptComplete = Extension.create<{ format: string }>({
  name: "scriptComplete",
  // Ahead of ScriptKeys' Tab (101), which switches the element when nothing is offered.
  priority: 102,

  addOptions() {
    return { format: "screenplay" };
  },

  addKeyboardShortcuts() {
    return { Tab: ({ editor }) => take(editor, this.options.format) };
  },

  addProseMirrorPlugins() {
    const format = this.options.format;
    return [
      new Plugin({
        key: new PluginKey("scriptComplete"),
        props: {
          decorations(state) {
            if (mentionIsOpen()) return null;
            const text = offer(state, format);
            if (!text) return null;
            const ghost = () => {
              const span = document.createElement("span");
              span.className = "script-ghost";
              span.textContent = text;
              span.setAttribute("aria-hidden", "true");
              return span;
            };
            return DecorationSet.create(state.doc, [
              Decoration.widget(state.selection.from, ghost, { side: 1, key: `ghost:${text}` }),
            ]);
          },
        },
      }),
    ];
  },
});
