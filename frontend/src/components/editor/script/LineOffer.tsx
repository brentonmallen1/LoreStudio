import type { Editor } from "@tiptap/core";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { offerKey, publish } from "./LineOfferExtension";

/**
 * An offer about one line of a script, shown as a quiet line under it in the text's flow (doc
 * 25): "Starts another scene · Start it here · Keep as a line". It was a bar over the top of the
 * scene, far from the line and over the words under it; here it sits where the eye already is
 * and pushes the next lines down. ProseMirror keeps a widget after the block
 * (LineOfferExtension.ts); React draws into it.
 */

/** `children` under the block that starts at `pos`; nothing while `pos` is null. */
export function LineOffer({
  editor,
  id,
  pos,
  children,
}: {
  editor: Editor;
  /** One offer each: the split and the line of dialogue can both be mounted. */
  id: string;
  pos: number | null;
  children: ReactNode;
}) {
  const [host] = useState(() => {
    const div = document.createElement("div");
    div.className = "script-line-offer";
    div.contentEditable = "false";
    return div;
  });
  useEffect(() => {
    const now = offerKey.getState(editor.state)?.[id];
    if ((now?.pos ?? null) !== pos) publish(editor, id, pos === null ? null : { pos, host });
  }, [editor, id, pos, host]);
  useEffect(() => () => publish(editor, id, null), [editor, id]);
  return pos === null ? null : createPortal(children, host);
}
