import { useEffect } from "react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import type { StoryFormat } from "../../types";
import { namedByHand, tagsByHand } from "../../lib/typing/tips";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { offerTip } from "../../stores/tipStore";

/** Hand-written speakers before `^` is offered: a third one (doc 26, P4). */
export const HAND_TAGS_BEFORE_TIP = 3;
/** Names typed out with the Lorebook beside the scene before `@` is offered. */
export const NAMES_BEFORE_TIP = 2;

/** The side panel shows the characters, the Lorebook or one character's sheet. */
export function lorebookBeside(): boolean {
  const { open, showing } = usePanelStore.getState();
  return (
    open &&
    (showing === "tool:characters" || showing === "page:lorebook" || showing.startsWith("entity:character:"))
  );
}

/**
 * Watches the writer's typing for the long way round (doc 26, P4): a quote's speaker written
 * out by hand in prose, where `^` would write it; a character's name typed in full with the
 * Lorebook open beside it, where `@` would link it. Only typing counts: a scene loading, an
 * undo or a paste does not.
 */
export function useTipWatch(editor: Editor | null, format: StoryFormat) {
  useEffect(() => {
    if (!editor) return;
    let tags = 0;
    let names = 0;
    // The paragraph being typed in, and whether it had a hand-written speaker already.
    let para = -1;
    let tagged = false;

    function onUpdate({ transaction: tr }: { transaction: Transaction }) {
      if (!editor || !tr.docChanged || tr.getMeta("addToHistory") === false || tr.getMeta("uiEvent")) return;
      const { $from } = editor.state.selection;
      if (!$from.parent.isTextblock) return;
      const text = $from.parent.textBetween(0, $from.parent.content.size, "\n", "￼");

      if (format === "prose") {
        const now = tagsByHand(text);
        if ($from.start() === para && now && !tagged && ++tags >= HAND_TAGS_BEFORE_TIP) offerTip("line");
        para = $from.start();
        tagged = now;
      }

      if (lorebookBeside()) {
        const before = text.slice(0, $from.parentOffset);
        const people = useStoryStore.getState().characters.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
        if (namedByHand(before, people) && ++names >= NAMES_BEFORE_TIP) offerTip("mention");
      }
    }

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, format]);
}
