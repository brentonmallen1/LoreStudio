import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { sceneSequence } from "../../lib/panel/sequence";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import PinnedScene from "./scene/PinnedScene";
import SceneGlance from "./scene/SceneGlance";
import styles from "./Panel.module.css";

/**
 * The tab that follows you (doc 11, slimmed in doc 24 D19): the open scene at a glance, with
 * the Scene sheet a click away for everything else. An act or a chapter has its own page,
 * which this tab points to. A scene ⌥-clicked on the strip sits on top, read-only, until it
 * is unpinned.
 */
export default function ThisSceneTab() {
  const { activeNode, activeStory, structure, activeTemplate, setActiveNode } = useStoryStore();
  const pinned = usePanelStore((s) => s.pinnedSceneId);

  // A node from the tree listing carries no planning fields; fetch it before showing them.
  const needsFull = !!activeNode && activeNode.content === undefined;
  useEffect(() => {
    if (!needsFull || !activeNode) return;
    const id = activeNode.id;
    api.getNode(id).then((full) => {
      if (useStoryStore.getState().activeNode?.id === id) setActiveNode(full);
    });
  }, [needsFull, activeNode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeNode || !activeStory) {
    return (
      <section className={styles.section}>
        <p className={styles.empty}>Open a scene and its notes appear here.</p>
      </section>
    );
  }
  if (needsFull) return <p className={`${styles.section} ${styles.empty}`}>Loading…</p>;

  const sequence = sceneSequence(structure, activeTemplate, activeNode.id);

  return (
    <>
      {pinned && pinned !== activeNode.id && <PinnedScene key={pinned} id={pinned} />}
      {sequence ? (
        <SceneGlance node={activeNode} story={activeStory} sequence={sequence} />
      ) : (
        <section className={styles.section}>
          <p className={styles.empty}>
            {activeNode.title} is not a scene: its plan and what it holds are on{" "}
            <Link to={`/stories/${activeStory.id}/write/${activeNode.id}`}>its own page</Link>.
          </p>
        </section>
      )}
    </>
  );
}
