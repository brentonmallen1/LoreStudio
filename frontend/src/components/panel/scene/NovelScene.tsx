import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { proseParagraphs, sceneSequence } from "../../../lib/panel/sequence";
import { useFullNode } from "../../../lib/panel/useFullNode";
import { readingOrder } from "../../../lib/timeline";
import { navigateTo } from "../../../lib/navigation";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import type { StructureNode } from "../../../types";
import panel from "../Panel.module.css";
import styles from "./SceneSequence.module.css";

/**
 * "The novel" beside a script adapted from one (doc 25, P10): the novel's version of the open
 * scene, its prose whole and read-only, to write the script from. Nothing is converted; the
 * author reads and writes. Each scene starts paired with the scene it was made from, and the
 * pairing can be changed here (a scene split, or one the author added), as one undoable step.
 */
export default function NovelScene() {
  const { activeStory, activeNode, stories, structure, activeTemplate, patchNode } = useStoryStore();
  const novelId = activeStory?.adapted_from_id ?? null;
  const [scenes, setScenes] = useState<StructureNode[] | null>(null);
  const sourceId = activeNode?.adapted_from_id ?? null;
  const source = useFullNode(sourceId);
  const novelTitle = stories.find((s) => s.id === novelId)?.title ?? "the novel";

  useEffect(() => {
    if (!novelId) return;
    api
      .getStructure(novelId)
      .then((tree) => setScenes(readingOrder(tree)))
      .catch(() => setScenes([]));
  }, [novelId]);

  // ⌘Z on a change of pairing puts the old one back on the server; read it again.
  useReloadOnUndo(["structure_node"], async () => {
    const id = useStoryStore.getState().activeNode?.id;
    if (id) patchNode(id, { adapted_from_id: (await api.getNode(id)).adapted_from_id ?? null });
  });

  if (!novelId) return null;
  if (!activeNode || !sceneSequence(structure, activeTemplate, activeNode.id)) {
    return (
      <section className={panel.section}>
        <p className={panel.empty}>Open a scene to read the novel’s version of it here.</p>
      </section>
    );
  }

  async function pair(id: string) {
    if (!activeNode) return;
    try {
      const updated = await api.updateNode(activeNode.id, { adapted_from_id: id || null });
      patchNode(activeNode.id, { adapted_from_id: updated.adapted_from_id ?? null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The scene could not be paired.");
    }
  }

  const paragraphs = source ? proseParagraphs(source.content) : [];
  return (
    <section className={panel.section} aria-label={`From ${novelTitle}`}>
      <h4 className={panel.heading}>From “{novelTitle}”</h4>
      <label className={styles.fact}>
        <span className={styles.factLabel}>{activeNode.title} tells</span>
        <select className={panel.select} value={sourceId ?? ""} onChange={(e) => pair(e.target.value)}>
          <option value="">No scene of the novel</option>
          {(scenes ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      {!sourceId ? (
        <p className={styles.muted}>
          Choose the scene of the novel this one tells, and its prose shows here.
        </p>
      ) : !source ? (
        <p className={styles.muted}>Reading the novel…</p>
      ) : (
        <>
          {source.synopsis && <p className={styles.pinnedText}>{source.synopsis}</p>}
          {paragraphs.length ? (
            <div className={styles.prose}>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>The novel has no prose in this scene yet.</p>
          )}
          <div>
            <button
              type="button"
              className={styles.openBtn}
              onClick={() => navigateTo(`/stories/${novelId}/write?node=${source.id}`)}
            >
              Open in the novel
            </button>
          </div>
        </>
      )}
    </section>
  );
}
