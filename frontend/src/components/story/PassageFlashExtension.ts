/**
 * Lights up passages for a moment: the words a finding rests on, when the author asks to
 * see them. A decoration, so ProseMirror's own DOM is never touched; it follows the text
 * through edits and is cleared by whoever set it.
 */
import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const FLASH_KEY = new PluginKey<DecorationSet>("lorestudio-passage-flash");

type Range = { from: number; to: number };

export const PassageFlashExtension = Extension.create({
  name: "lorestudioPassageFlash",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: FLASH_KEY,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const ranges = tr.getMeta(FLASH_KEY) as Range[] | undefined;
            if (ranges)
              return DecorationSet.create(
                tr.doc,
                ranges.map((r) => Decoration.inline(r.from, r.to, { class: "ls-passage-flash" })),
              );
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => FLASH_KEY.getState(state) },
      }),
    ];
  },
});

/** Light up `ranges`; an empty list clears them. */
export function flashPassages(editor: Editor, ranges: Range[]): void {
  editor.view.dispatch(editor.state.tr.setMeta(FLASH_KEY, ranges).setMeta("addToHistory", false));
}
