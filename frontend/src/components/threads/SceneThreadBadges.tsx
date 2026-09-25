import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import type { PlotThread } from "../../types";
import styles from "./SceneThreadBadges.module.css";

interface Props {
  storyId: string;
  nodeId: string;
}

export default function SceneThreadBadges({ storyId, nodeId }: Props) {
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listThreads(storyId)
      .then(setThreads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

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
    <div className={styles.wrap}>
      {activeThreads.map((t) => (
        <span
          key={t.id}
          className={styles.badge}
          // The thread's colour is the author's choice and can be anything; the CSS derives a
          // readable text colour from it rather than printing it straight onto the surface.
          style={{ borderColor: t.color, "--thread-color": t.color } as React.CSSProperties}
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
                  <span className={styles.pickerDot} style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
