import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import { slotVar } from "../../lib/colorSlots";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import type { PlotThread } from "../../types";
import styles from "./SceneThreadBadges.module.css";

interface Props {
  storyId: string;
  nodeId: string;
}

export default function SceneThreadBadges({ storyId, nodeId }: Props) {
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  // In a narrow top bar the chips fold into one "2 threads" button (doc 14 review).
  const [unfolded, setUnfolded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listThreads(storyId)
      .then(setThreads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  useReloadOnUndo(["plot_thread", "plot_thread_appearance", "structure_node"], () =>
    api.listThreads(storyId).then(setThreads),
  );

  const activeThreads = threads.filter((t) => t.appearances.some((a) => a.node_id === nodeId));
  const inactiveThreads = threads.filter((t) => !t.appearances.some((a) => a.node_id === nodeId));

  async function addThread(threadId: string) {
    await api.addThreadAppearance(threadId, nodeId);
    const updated = await api.listThreads(storyId);
    setThreads(updated);
    setShowPicker(false);
  }

  async function removeThread(threadId: string) {
    await api.removeThreadAppearance(threadId, nodeId);
    const updated = await api.listThreads(storyId);
    setThreads(updated);
  }

  if (loading) return null;

  return (
    <div className={styles.wrap} data-open={unfolded || undefined}>
      <button
        type="button"
        className={styles.compact}
        aria-expanded={unfolded}
        onClick={() => setUnfolded((v) => !v)}
      >
        {activeThreads.length === 0
          ? "Threads"
          : `${activeThreads.length} ${activeThreads.length === 1 ? "thread" : "threads"}`}
      </button>
      <div className={styles.chips}>
        {activeThreads.map((t) => (
          <span
            key={t.id}
            className={styles.badge}
            // The thread's palette slot (doc 11 P2): the theme's own ink, so it reads on its surfaces.
            style={
              {
                borderColor: slotVar(t.color_slot),
                "--thread-color": slotVar(t.color_slot),
              } as React.CSSProperties
            }
          >
            {t.name}
            <button
              onClick={() => removeThread(t.id)}
              className={styles.removeBadge}
              aria-label={`Remove ${t.name}`}
            >
              <X size={9} />
            </button>
          </span>
        ))}

        {inactiveThreads.length > 0 && (
          <div className={styles.addWrap}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className={styles.addBadgeBtn}
              aria-label="Add thread"
            >
              <Plus size={10} />
            </button>
            {showPicker && (
              <div className={styles.picker}>
                {inactiveThreads.map((t) => (
                  <button key={t.id} onClick={() => addThread(t.id)} className={styles.pickerItem}>
                    <span className={styles.pickerDot} style={{ background: slotVar(t.color_slot) }} />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
