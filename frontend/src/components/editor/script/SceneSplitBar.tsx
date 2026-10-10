import { getHTMLFromFragment, type Editor } from "@tiptap/core";
import { useState } from "react";
import { api } from "../../../api/client";
import { ApiError } from "../../../api/request";
import { reloadStructure } from "../../../lib/story/loadStory";
import { loadScene } from "../../../lib/undo/sceneHistory";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import banner from "../DraftBanner.module.css";
import styles from "./SceneSplitBar.module.css";
import { headingBelowTop, setElementAt } from "./ScriptElementExtension";

/**
 * A script scene is one heading (doc 25, D3). A heading typed further down starts another
 * scene: this quiet bar offers to start it there, or to keep the words as an action line.
 * The split saves first, then the server cuts the scene in one change ⌘Z takes back whole.
 */
export default function SceneSplitBar({ editor, flush }: { editor: Editor; flush: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const at = headingBelowTop(editor);
  if (at === null) return null;

  async function split(pos: number) {
    const node = useStoryStore.getState().activeNode;
    if (!node) return;
    setBusy(true);
    try {
      await flush();
      const { doc, schema } = editor.state;
      const before = getHTMLFromFragment(doc.content.cut(0, pos), schema);
      const after = getHTMLFromFragment(doc.content.cut(pos), schema);
      const expected = useStoryStore.getState().activeNode?.updated_at;
      await api.splitNode(node.id, { content: before, new_content: after, expected_updated_at: expected });
      loadScene(editor, before);
      const store = useStoryStore.getState();
      if (store.activeNode?.id === node.id) store.setActiveNode(await api.getNode(node.id));
      await reloadStructure();
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 409
          ? "This scene changed somewhere else. Save it, then try again."
          : "The new scene was not started. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  function keepAsLine(pos: number) {
    editor.view.dispatch(setElementAt(editor.state.tr, pos, "action"));
    editor.commands.focus();
  }

  return (
    <div className={styles.bar} role="status">
      <span>This heading starts another scene.</span>
      <span className={banner.actions}>
        <button className={banner.btn} disabled={busy} onClick={() => void split(at)}>
          Start a new scene here
        </button>
        <button className={banner.btn} disabled={busy} onClick={() => keepAsLine(at)}>
          Keep as a line
        </button>
      </span>
    </div>
  );
}
