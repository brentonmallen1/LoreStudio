import { useState } from "react";
import { PenLine } from "lucide-react";
import { api } from "../../api/client";
import { structureApi } from "../../api/structure";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { findNode } from "../layout/structureTreeMeta";
import styles from "./EmptyManuscript.module.css";

/**
 * The Write page with no scene open.
 *
 * A story with no outline used to show "Pick a section in the structure tree" beside a
 * tree that said "No sections yet". Now it offers to lay out the story's first outline
 * and opens its first scene, so an empty story is one click from typing.
 */
export default function EmptyManuscript() {
  const { activeStory, activeTemplate, structure, setStructure, setActiveNode } = useStoryStore();
  const { stripWidth, setStripWidth } = useUIStore();
  const [starting, setStarting] = useState(false);

  if (structure.length > 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.text}>Pick a scene in the story strip to begin writing.</p>
        {stripWidth !== "scenes" && (
          <button className={styles.secondary} onClick={() => setStripWidth("scenes")}>
            Show the full tree
          </button>
        )}
      </div>
    );
  }

  const leaf = activeTemplate?.levels.at(-1)?.name.toLowerCase() ?? "scene";

  async function start() {
    if (!activeStory) return;
    setStarting(true);
    try {
      const { start_node_id } = await structureApi.start(activeStory.id);
      const tree = await api.getStructure(activeStory.id);
      setStructure(tree);
      setActiveNode(findNode(tree, start_node_id) ?? null);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className={styles.empty}>
      <div className={styles.card}>
        <p className={styles.title}>Nothing written yet</p>
        <p className={styles.text}>
          {activeTemplate?.starter_outline?.length
            ? `Start with the ${activeTemplate.name} outline (${activeTemplate.starter_outline.join(", ")}) and a first ${leaf} to write in. Rename, move or delete any of it.`
            : `Start with a first ${leaf} to write in.`}
        </p>
        <button className={styles.primary} onClick={start} disabled={starting}>
          <PenLine size={14} />
          {starting ? "Setting up…" : "Start writing"}
        </button>
      </div>
    </div>
  );
}
