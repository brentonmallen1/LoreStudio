/**
 * TodoExtension — TipTap extension for editor gutter TODO markers.
 *
 * Renders a chartreuse right-facing triangle in the left gutter for any TODO
 * that has a doc_from position within the current scene. Hovering the marker
 * shows a tooltip with the TODO content.
 *
 * The extension holds a module-level todo list that is set by SceneEditor via
 * setTodoGutterItems() when todos are loaded or change.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TodoGutterItem {
  id: string;
  content: string;
  done: boolean;
  doc_from: number;
}

// ---------------------------------------------------------------------------
// Module-level state (safe: one editor instance at a time)
// ---------------------------------------------------------------------------

let _todos: TodoGutterItem[] = [];

export function setTodoGutterItems(items: TodoGutterItem[]) {
  _todos = items.filter((t) => !t.done && t.doc_from != null);
}

export interface TodoGutterCallbacks {
  onMarkerClick: (todoId: string) => void;
}

const _cb: TodoGutterCallbacks = {
  onMarkerClick: () => {},
};

export function setTodoGutterCallbacks(cb: Partial<TodoGutterCallbacks>) {
  Object.assign(_cb, cb);
}

// Used to force a redraw when todos change without doc edits
export const FORCE_TODO_REBUILD = "forceTodoRebuild";

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildTodoDecos(doc: PMNode): DecorationSet {
  if (_todos.length === 0) return DecorationSet.empty;

  const decos: Decoration[] = [];

  // Map doc_from positions to their block-start positions so we can show one
  // marker per block (first todo in each block wins)
  const usedBlocks = new Set<number>();

  for (const todo of _todos) {
    const pos = todo.doc_from;
    if (pos < 0 || pos > doc.content.size) continue;

    // Resolve the position to find the block node
    try {
      const $pos = doc.resolve(Math.min(pos, doc.content.size - 1));
      const blockStart = $pos.before($pos.depth > 0 ? $pos.depth : 1);

      if (usedBlocks.has(blockStart)) continue;
      usedBlocks.add(blockStart);

      const todoId = todo.id;
      const content = todo.content;

      // Triangle marker element
      const el = document.createElement("button");
      el.type = "button";
      el.className = "todo-gutter-marker";
      el.setAttribute("aria-label", `TODO: ${content}`);
      el.setAttribute("data-todo-id", todoId);
      el.title = content; // native tooltip as fallback

      // Tooltip (hover)
      const tooltip = document.createElement("span");
      tooltip.className = "todo-gutter-tooltip";
      tooltip.textContent = content;
      el.appendChild(tooltip);

      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _cb.onMarkerClick(todoId);
      });

      decos.push(
        Decoration.widget(blockStart + 1, el, {
          side: -1,
          key: `todo-gutter:${todoId}`,
        })
      );
    } catch {
      // pos may be out of range after edits — skip silently
    }
  }

  return DecorationSet.create(doc, decos);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const todoGutterKey = new PluginKey<DecorationSet>("todoGutter");

export const TodoExtension = Extension.create({
  name: "todoGutter",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: todoGutterKey,
        state: {
          init: (_, state) => buildTodoDecos(state.doc),
          apply: (tr, old) => {
            if (tr.docChanged || tr.getMeta(FORCE_TODO_REBUILD)) {
              return buildTodoDecos(tr.doc);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => todoGutterKey.getState(state),
        },
      }),
    ];
  },
});
