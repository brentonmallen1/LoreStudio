import { useEffect } from "react";
import { api } from "../../api/client";
import { useEditorBridge } from "../../stores/editorBridge";
import { useStoryStore } from "../../stores/storyStore";
import SceneOverviewPanel from "../editor/panels/SceneOverviewPanel";
import StoryPlanPanel from "../editor/panels/StoryPlanPanel";
import styles from "./Panel.module.css";

/**
 * The tab that follows you (doc 11): the open scene's notes on top, the story's plan
 * folded underneath. Both are the panels the editor's old side column held.
 */
export default function ThisSceneTab() {
  const { activeNode, activeStory, characters, locations, setActiveNode } = useStoryStore();
  const notes = useEditorBridge((s) => s.notes);

  // A node from the tree listing carries no prose or purpose; fetch it before showing
  // fields that would otherwise look empty and could be saved over.
  const needsFull = !!activeNode && activeNode.content === undefined;
  useEffect(() => {
    if (!needsFull || !activeNode) return;
    const id = activeNode.id;
    api.getNode(id).then((full) => {
      if (useStoryStore.getState().activeNode?.id === id) setActiveNode(full);
    });
  }, [needsFull, activeNode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeNode) {
    return (
      <section className={styles.section}>
        <p className={styles.empty}>Open a scene and its notes appear here.</p>
      </section>
    );
  }
  if (needsFull) return <p className={`${styles.section} ${styles.empty}`}>Loading…</p>;

  return (
    <>
      <div className={styles.overviewWrap}>
        <SceneOverviewPanel
          key={activeNode.id}
          activeNode={activeNode}
          activeStory={activeStory}
          characters={characters}
          locations={locations}
          notes={notes ?? undefined}
        />
      </div>
      {activeStory && (
        <details className={styles.details} open>
          <summary>Story plan</summary>
          <StoryPlanPanel node={activeNode} story={activeStory} characters={characters} />
        </details>
      )}
    </>
  );
}
