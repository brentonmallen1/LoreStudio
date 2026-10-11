import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { lineHint } from "../../../lib/script/guide";
import { elementLabel, isElement } from "../../../lib/script/syntax";

/**
 * The line being written, marked for the element guides (doc 25, P3½): its element's name, for
 * the left margin, and when it is empty what it is and where Tab takes it, at its own indent.
 * Only marks; ScriptEditor.module.css shows them while Element guides is on (the default), so a
 * writer who knows the format turns them off in one place. Decorations never touch the stored
 * text or the history.
 */
export const ScriptGuide = Extension.create<{ format: string }>({
  name: "scriptGuide",

  addOptions() {
    return { format: "screenplay" };
  },

  addProseMirrorPlugins() {
    const format = this.options.format;
    return [
      new Plugin({
        key: new PluginKey("scriptGuide"),
        // The element's name in the left margin, level with the line being written: placed
        // from where the line is on screen, so a centred or right-set line keeps it in the
        // same margin as every other. Outside the editable text, so ProseMirror never sees it.
        view(view) {
          const label = document.createElement("span");
          label.className = "script-margin-label";
          label.setAttribute("aria-hidden", "true");
          const host = view.dom.parentElement;
          if (host && getComputedStyle(host).position === "static") host.style.position = "relative";
          host?.appendChild(label);
          const place = () => {
            const line = view.dom.querySelector<HTMLElement>("p.el-here");
            if (!host || !line || !view.hasFocus()) {
              label.hidden = true;
              return;
            }
            const box = host.getBoundingClientRect();
            const lineBox = line.getBoundingClientRect();
            const editable = view.dom.getBoundingClientRect();
            label.textContent = line.dataset.label ?? "";
            label.style.top = `${lineBox.top - box.top}px`;
            label.style.left = `${editable.left - box.left}px`;
            label.hidden = false;
          };
          const onFocus = () => requestAnimationFrame(place);
          view.dom.addEventListener("focus", onFocus);
          view.dom.addEventListener("blur", onFocus);
          requestAnimationFrame(place);
          return {
            update: () => requestAnimationFrame(place),
            destroy: () => {
              view.dom.removeEventListener("focus", onFocus);
              view.dom.removeEventListener("blur", onFocus);
              label.remove();
            },
          };
        },
        props: {
          decorations(state) {
            const { $from } = state.selection;
            if ($from.depth < 1) return null;
            const block = $from.node(1);
            if (block.type.name !== "paragraph") return null;
            const el = isElement(block.attrs.el) ? block.attrs.el : "action";
            const at = $from.before(1);
            const empty = block.content.size === 0;
            const attrs: Record<string, string> = {
              class: empty ? "el-here el-empty" : "el-here",
              "data-label": elementLabel(el, format),
            };
            // The empty scene shows the editor's own placeholder instead.
            if (empty && state.doc.childCount > 1) attrs["data-hint"] = lineHint(el, format);
            return DecorationSet.create(state.doc, [Decoration.node(at, at + block.nodeSize, attrs)]);
          },
        },
      }),
    ];
  },
});
