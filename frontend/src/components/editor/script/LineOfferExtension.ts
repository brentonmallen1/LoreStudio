import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Where offers about script lines are drawn (LineOffer.tsx, doc 25): a widget after the line's
 * block, kept per offer and mapped through edits. Never stored, never in the history.
 */

export type Offers = Record<string, { pos: number; host: HTMLElement }>;
export const offerKey = new PluginKey<Offers>("lineOffer");

export const LineOfferExtension = Extension.create({
  name: "lineOffer",

  addProseMirrorPlugins() {
    return [
      new Plugin<Offers>({
        key: offerKey,
        state: {
          init: () => ({}),
          apply(tr, offers) {
            const meta = tr.getMeta(offerKey) as { id: string; offer: Offers[string] | null } | undefined;
            let next: Offers = offers;
            if (tr.docChanged)
              next = Object.fromEntries(
                Object.entries(next).map(([id, o]) => [id, { ...o, pos: tr.mapping.map(o.pos) }]),
              );
            if (meta) {
              next = { ...next };
              if (meta.offer) next[meta.id] = meta.offer;
              else delete next[meta.id];
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            const offers = offerKey.getState(state) ?? {};
            const widgets = Object.entries(offers).flatMap(([id, { pos, host }]) => {
              const block = state.doc.nodeAt(pos);
              if (!block) return [];
              return [
                Decoration.widget(pos + block.nodeSize, () => host, {
                  key: `line-offer-${id}`,
                  side: -1,
                  stopEvent: () => true,
                  ignoreSelection: true,
                }),
              ];
            });
            return widgets.length ? DecorationSet.create(state.doc, widgets) : null;
          },
        },
      }),
    ];
  },
});

export function publish(editor: Editor, id: string, offer: Offers[string] | null) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(offerKey, { id, offer }).setMeta("addToHistory", false));
}
