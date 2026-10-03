import { useEffect } from "react";
import { api } from "../../api/client";
import { sceneSequence } from "../../lib/panel/sequence";
import { useEditorBridge } from "../../stores/editorBridge";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import SceneOverviewPanel from "../editor/panels/SceneOverviewPanel";
import NeighbourScene from "./scene/NeighbourScene";
import PinnedScene from "./scene/PinnedScene";
import SceneMoreFields from "./scene/SceneMoreFields";
import styles from "./Panel.module.css";
import seq from "./scene/SceneSequence.module.css";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

/**
 * The tab that follows you (doc 11): the open scene in its sequence. It reads top to bottom
 * as time: how the scene before ended, this scene from its entry state to its exit state,
 * where the scene after picks up, then everything else about the scene, folded. A chapter's
 * own page has no sequence and shows its fields alone. A scene ⌥-clicked on the strip sits
 * on top, read-only, until it is unpinned.
 */
export default function ThisSceneTab() {
  const { activeNode, activeStory, characters, locations, structure, activeTemplate, setActiveNode } =
    useStoryStore();
  const notes = useEditorBridge((s) => s.notes);
  const pinned = usePanelStore((s) => s.pinnedSceneId);

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

  const sequence = activeStory ? sceneSequence(structure, activeTemplate, activeNode.id) : null;
  const words = activeNode.word_count ?? 0;

  return (
    <>
      {pinned && pinned !== activeNode.id && <PinnedScene key={pinned} id={pinned} />}
      {sequence && activeStory && <NeighbourScene side="before" sequence={sequence} story={activeStory} />}
      {sequence && (
        <header className={seq.here}>
          <h3 className={seq.hereTitle}>{activeNode.title}</h3>
          <p className={seq.hereMeta}>
            {[
              STATUS_LABEL[activeNode.status] ?? activeNode.status,
              `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`,
              `Scene ${sequence.position} of ${sequence.total}`,
              sequence.chapter,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
      )}
      <div className={styles.overviewWrap}>
        <SceneOverviewPanel
          key={activeNode.id}
          activeNode={activeNode}
          activeStory={activeStory}
          characters={characters}
          locations={locations}
        />
      </div>
      {sequence && activeStory && <NeighbourScene side="after" sequence={sequence} story={activeStory} />}
      {activeStory && (
        <SceneMoreFields
          key={activeNode.id}
          activeNode={activeNode}
          activeStory={activeStory}
          characters={characters}
          notes={notes ?? undefined}
        />
      )}
    </>
  );
}
