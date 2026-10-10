import { getHTMLFromFragment, type Editor } from "@tiptap/core";
import { useState } from "react";
import { api } from "../../../api/client";
import { ApiError } from "../../../api/request";
import { scriptApi } from "../../../api/script";
import { reloadStructure } from "../../../lib/story/loadStory";
import { loadScene } from "../../../lib/undo/sceneHistory";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import banner from "../DraftBanner.module.css";
import styles from "./SceneSplitBar.module.css";
import { headingBelowTop, headingsBelowTop, setElementAt } from "./ScriptElementExtension";

/**
 * A script scene is one heading (doc 25, D3). A heading typed further down starts another
 * scene: this quiet bar offers to start it there, or to keep the words as an action line.
 * The split saves first, then the server cuts the scene in one change ⌘Z takes back whole.
 * Several scenes pasted at once are offered as a whole: each starts at its heading (P6).
 */
export default function SceneSplitBar({ editor, flush }: { editor: Editor; flush: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const at = headingBelowTop(editor);
  const below = headingsBelowTop(editor.state.doc);
  const many = below.length;

  /** Save, cut on the server, and show the scene as it now reads. */
  async function cut(run: (nodeId: string, expected?: string) => Promise<string>) {
    const node = useStoryStore.getState().activeNode;
    if (!node) return;
    setBusy(true);
    try {
      await flush();
      const content = await run(node.id, useStoryStore.getState().activeNode?.updated_at);
      loadScene(editor, content);
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

  function split(pos: number) {
    const { doc, schema } = editor.state;
    const before = getHTMLFromFragment(doc.content.cut(0, pos), schema);
    const after = getHTMLFromFragment(doc.content.cut(pos), schema);
    return cut(async (nodeId, expected) => {
      await scriptApi.splitNode(nodeId, {
        content: before,
        new_content: after,
        expected_updated_at: expected,
      });
      return before;
    });
  }

  function splitAll() {
    return cut(async (nodeId, expected) => (await scriptApi.splitAtHeadings(nodeId, expected)).content ?? "");
  }

  function keepAsLine(pos: number) {
    editor.view.dispatch(setElementAt(editor.state.tr, pos, "action"));
    editor.commands.focus();
  }

  /** Every heading below the scene's own, as action: the pasted scenes stay one. */
  function keepAsLines() {
    let tr = editor.state.tr;
    for (const pos of below) tr = setElementAt(tr, pos, "action");
    editor.view.dispatch(tr);
    editor.commands.focus();
  }

  if (many >= 2) {
    return (
      <div className={styles.bar} role="status">
        <span>This scene holds {many} more scenes, each with its own heading.</span>
        <span className={banner.actions}>
          <button className={banner.btn} disabled={busy} onClick={() => void splitAll()}>
            Start each as a scene
          </button>
          <button className={banner.btn} disabled={busy} onClick={keepAsLines}>
            Keep as one scene
          </button>
        </span>
      </div>
    );
  }

  if (at === null) return null;
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
