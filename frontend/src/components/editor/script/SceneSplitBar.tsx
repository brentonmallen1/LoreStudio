import { getHTMLFromFragment, type Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import { ApiError } from "../../../api/request";
import { scriptApi } from "../../../api/script";
import { navigateTo } from "../../../lib/navigation";
import { isAct } from "../../../lib/script/syntax";
import { reloadStructure } from "../../../lib/story/loadStory";
import { keepBeforeCut, loadScene } from "../../../lib/undo/sceneHistory";
import { useEditorBridge } from "../../../stores/editorBridge";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import { LineOffer } from "./LineOffer";
import styles from "./SceneSplitBar.module.css";
import { headingBelowTop, headingsBelowTop, setElementAt, setHeadingEnter } from "./ScriptElementExtension";

/**
 * A script scene is one heading (doc 25, D3). A heading typed further down starts another
 * scene. Enter at the end of it starts the new scene there and carries on in it; until then, a
 * quiet line under it offers to start it there, or to keep the words as an action line.
 * The split saves first, then the server cuts the scene in one change ⌘Z takes back whole.
 * Several scenes pasted at once are offered as a whole: each starts at its heading (P6).
 */
export default function SceneSplitBar({ editor, flush }: { editor: Editor; flush: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const below = headingsBelowTop(editor.state.doc);
  const many = below.length;
  // The heading the cursor is on, or the one heading below the top wherever the cursor is:
  // a heading left mid-scene keeps its offer until it is answered.
  const at = headingBelowTop(editor) ?? (many === 1 ? below[0] : null);

  /** Save, cut on the server, and show the scene as it now reads. */
  async function cut(run: (nodeId: string, expected?: string) => Promise<string>) {
    const node = useStoryStore.getState().activeNode;
    if (!node) return;
    setBusy(true);
    try {
      await flush();
      const content = await run(node.id, useStoryStore.getState().activeNode?.updated_at);
      keepBeforeCut(editor, node.id);
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

  /**
   * Enter at the end of the heading: split there, with a fresh line under the heading (a scene
   * marker after a play's act, else action), and open the new scene on that line.
   */
  function splitAndOpen(pos: number) {
    const { doc, schema } = editor.state;
    const heading = doc.nodeAt(pos);
    const storyId = useStoryStore.getState().activeStory?.id;
    if (!heading || !storyId) return;
    const next = isAct("heading", heading.textContent) ? "heading" : "action";
    const before = getHTMLFromFragment(doc.content.cut(0, pos), schema);
    // A fresh line under the heading, unless an empty one is there already.
    const following = doc.nodeAt(pos + heading.nodeSize);
    const fresh = following && !following.content.size ? "" : `<p data-el="${next}"></p>`;
    const after =
      getHTMLFromFragment(doc.content.cut(pos, pos + heading.nodeSize), schema) +
      fresh +
      getHTMLFromFragment(doc.content.cut(pos + heading.nodeSize), schema);
    void (async () => {
      const node = useStoryStore.getState().activeNode;
      if (!node) return;
      setBusy(true);
      try {
        await flush();
        const made = await scriptApi.splitNode(node.id, {
          content: before,
          new_content: after,
          expected_updated_at: useStoryStore.getState().activeNode?.updated_at,
        });
        // This scene as it now reads, so nothing saves the old text back over the cut; ⌘Z
        // brings back the editor as it was, typing and all.
        keepBeforeCut(editor, node.id);
        loadScene(editor, before);
        await reloadStructure();
        useEditorBridge.getState().setOpenAt({ nodeId: made.id, block: 1 });
        navigateTo(`/stories/${storyId}/write/${made.id}`);
      } catch (e) {
        toast.error(
          e instanceof ApiError && e.status === 409
            ? "This scene changed somewhere else. Save it, then try again."
            : "The new scene was not started. Try again in a moment.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }
  const splitOnEnter = useRef(splitAndOpen);
  useEffect(() => {
    splitOnEnter.current = splitAndOpen;
  });
  useEffect(() => {
    setHeadingEnter((pos) => void splitOnEnter.current(pos));
    return () => setHeadingEnter(null);
  }, []);

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

  const centred = useStoryStore((s) => s.activeStory?.story_format === "stage_play");
  if (many >= 2) {
    return (
      <LineOffer editor={editor} id="split" pos={below[0]}>
        <span className={styles.offer} data-centred={centred || undefined} role="status">
          <span>This scene holds {many} more scenes, each with its own heading</span>
          <button className={styles.action} disabled={busy} onClick={() => void splitAll()}>
            Start each as a scene
          </button>
          <button className={styles.action} disabled={busy} onClick={keepAsLines}>
            Keep as one scene
          </button>
        </span>
      </LineOffer>
    );
  }

  return (
    <LineOffer editor={editor} id="split" pos={at}>
      {at !== null && (
        <span className={styles.offer} data-centred={centred || undefined} role="status">
          <span>Starts another scene</span>
          <button className={styles.action} disabled={busy} onClick={() => void split(at)}>
            Start it here
          </button>
          <button className={styles.action} disabled={busy} onClick={() => keepAsLine(at)}>
            Keep as a line
          </button>
        </span>
      )}
    </LineOffer>
  );
}
