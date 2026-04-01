import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { api } from "../../api/client";
import type { PlotThread } from "../../types";
import styles from "./PlotThreadManager.module.css";

interface Props {
  storyId: string;
}

const STATUS_OPTIONS = ["open", "developing", "resolved"] as const;
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  developing: "Developing",
  resolved: "Resolved",
};

const PRESET_COLORS = [
  "#6b7280", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
];

export default function PlotThreadManager({ storyId }: Props) {
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editFields, setEditFields] = useState<{ name: string; description: string; status: string; color: string }>({
    name: "", description: "", status: "open", color: PRESET_COLORS[0],
  });

  useEffect(() => {
    api.listThreads(storyId)
      .then(setThreads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const thread = await api.createThread(storyId, { name: newName.trim(), color: newColor });
    setThreads((prev) => [...prev, thread]);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
  }

  function startEdit(t: PlotThread) {
    setEditingId(t.id);
    setEditFields({ name: t.name, description: t.description, status: t.status, color: t.color });
  }

  async function saveEdit(id: string) {
    const updated = await api.updateThread(id, editFields);
    setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plot thread?")) return;
    await api.deleteThread(id);
    setThreads((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <p className={styles.loading}>Loading…</p>;

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <h2 className={styles.title}>Plot Threads</h2>
        <button onClick={() => setCreating(true)} className={styles.addBtn}>
          <Plus size={13} />
          New thread
        </button>
      </div>

      {creating && (
        <div className={styles.createForm}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Thread name…"
            className={styles.nameInput}
          />
          <div className={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ""}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className={styles.createActions}>
            <button onClick={() => setCreating(false)} className={styles.cancelBtn}>Cancel</button>
            <button onClick={handleCreate} disabled={!newName.trim()} className={styles.saveBtn}>
              Create
            </button>
          </div>
        </div>
      )}

      <div className={styles.threadList}>
        {threads.length === 0 && !creating && (
          <p className={styles.empty}>No plot threads yet. Add one to start tracking narrative threads.</p>
        )}
        {threads.map((t) => (
          <div key={t.id} className={styles.threadCard}>
            {editingId === t.id ? (
              <div className={styles.editForm}>
                <input
                  value={editFields.name}
                  onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                  className={styles.nameInput}
                  placeholder="Thread name"
                />
                <textarea
                  value={editFields.description}
                  onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                  className={styles.descInput}
                  placeholder="Description (optional)"
                  rows={2}
                />
                <div className={styles.editRow}>
                  <select
                    value={editFields.status}
                    onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value }))}
                    className={styles.statusSelect}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <div className={styles.colorRow}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`${styles.colorSwatch} ${editFields.color === c ? styles.colorSelected : ""}`}
                        style={{ background: c }}
                        onClick={() => setEditFields((f) => ({ ...f, color: c }))}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div className={styles.createActions}>
                  <button onClick={() => setEditingId(null)} className={styles.cancelBtn}>
                    <X size={12} /> Cancel
                  </button>
                  <button onClick={() => saveEdit(t.id)} className={styles.saveBtn}>
                    <Check size={12} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.threadLeft}>
                  <span className={styles.colorDot} style={{ background: t.color }} />
                  <div className={styles.threadBody}>
                    <span className={styles.threadName}>{t.name}</span>
                    {t.description && (
                      <p className={styles.threadDesc}>{t.description}</p>
                    )}
                    <div className={styles.threadMeta}>
                      <span className={`${styles.statusBadge} ${styles[`status_${t.status}`]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                      <span className={styles.appearCount}>
                        {t.appearances.length} scene{t.appearances.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.threadActions}>
                  <button onClick={() => startEdit(t)} className={styles.iconBtn} aria-label="Edit">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className={`${styles.iconBtn} ${styles.danger}`} aria-label="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
