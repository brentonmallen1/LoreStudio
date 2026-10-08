import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { redoDepth, undoDepth } from "@tiptap/pm/history";
import { isReplaying, notify } from "../../lib/undo/sceneHistory";
import { runUndo, typed } from "../../stores/undoStore";

const key = new PluginKey("unifiedUndo");

/**
 * ⌘Z and ⇧⌘Z in the prose go through the story's one undo timeline (doc 23 P5b): the last
 * thing the author did, here or anywhere else in the story, is what comes back. A keystroke
 * that opens a new step in the editor's history is a step on the timeline.
 */
export const UnifiedUndoExtension = Extension.create({
  name: "unifiedUndo",
  // Above StarterKit's History, whose own ⌘Z would undo typing only.
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      "Mod-z": () => (runUndo("undo"), true),
      "Shift-Mod-z": () => (runUndo("redo"), true),
      "Mod-y": () => (runUndo("redo"), true),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        view: () => ({
          update(view, prev) {
            const before = undoDepth(prev);
            const after = undoDepth(view.state);
            if (after > before && !isReplaying() && redoDepth(view.state) === 0) typed();
            if (after !== before || redoDepth(prev) !== redoDepth(view.state)) notify();
          },
        }),
      }),
    ];
  },
});
