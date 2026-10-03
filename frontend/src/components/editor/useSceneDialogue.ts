import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { api } from "../../api/client";
import { FORCE_DIALOGUE_KEY, setSceneDialogue } from "../story/DialogueExtension";

/**
 * The scene's lines as the server attributes them (doc 16, D1), fetched when the scene
 * opens and again after each save (a save moves `updatedAt`), then handed to the dialogue
 * decorations. A failure leaves untagged lines plain: nothing is guessed in their place.
 */
export function useSceneDialogue(
  editor: Editor | null,
  sceneId: string | undefined,
  updatedAt: string | undefined,
) {
  useEffect(() => {
    if (!editor || !sceneId) return;
    let gone = false;
    api
      .listDialogue(sceneId)
      .then((lines) => {
        if (gone || editor.isDestroyed) return;
        setSceneDialogue(lines);
        editor.view.dispatch(editor.state.tr.setMeta(FORCE_DIALOGUE_KEY, true));
      })
      .catch(() => {});
    return () => {
      gone = true;
      setSceneDialogue([]);
    };
  }, [editor, sceneId, updatedAt]);
}
