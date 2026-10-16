import { useEffect, useState } from "react";
import { takesApi } from "../../../api/takes";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { reloadStructure } from "../../../lib/story/loadStory";
import { useEditorBridge } from "../../../stores/editorBridge";
import { takeName, useTakesStore } from "../../../stores/takesStore";
import { toast } from "../../../stores/toastStore";
import type { StructureNode } from "../../../types";
import type { SceneTake } from "../../../types/takes";
import TakesCompare from "./TakesCompare";
import styles from "./Takes.module.css";

/**
 * A scene's takes in the side panel's This scene (doc 29 D7): how many, which counts, and Compare
 * one above the other. While the scene is open in the editor these are the editor's takes, saved
 * first; otherwise the panel reads them itself.
 */
export default function TakesGlance({ node }: { node: StructureNode }) {
  const count = node.take_count ?? 1;
  const bridge = useEditorBridge((s) => s.takes);
  const store = useTakesStore();
  const live = !!bridge && store.nodeId === node.id && store.loaded;
  const [own, setOwn] = useState<SceneTake[] | null>(null);
  const [open, setOpen] = useState(false);

  const read = () =>
    takesApi
      .list(node.id)
      .then((out) => setOwn(out.takes))
      .catch(() => setOwn([]));
  useEffect(() => {
    if (!live && count > 1) void read();
  }, [node.id, count, live]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnUndo(["scene_take", "structure_node"], () => (!live && count > 1 ? read() : undefined));

  const takes = live ? store.takes : (own ?? []);
  if (count < 2 || takes.length < 2) return null;
  const counting = takes.find((t) => t.counts);

  async function toggle() {
    if (!open && live) await bridge?.refresh().catch(() => {});
    setOpen(!open);
  }

  async function use(take: SceneTake) {
    if (live) return bridge?.use(take.id);
    try {
      setOwn((await takesApi.use(take.id)).takes);
      void reloadStructure();
      toast.info(`${takeName(take)} counts now: it is the scene in your manuscript, exports and checks.`);
    } catch {
      toast.error("That take was not chosen. Try again in a moment.");
    }
  }

  return (
    <section className={styles.glance} aria-label="Takes">
      <div className={styles.glanceLine}>
        <span>
          {takes.length} takes{counting ? ` · ${takeName(counting)} counts` : ""}
        </span>
        <button type="button" className={styles.action} aria-expanded={open} onClick={() => void toggle()}>
          {open ? "Close" : "Compare"}
        </button>
      </div>
      {open && <TakesCompare takes={takes} onUse={(t) => void use(t)} />}
    </section>
  );
}
