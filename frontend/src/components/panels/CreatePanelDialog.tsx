import { useState } from "react";
import { X, Users } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { PanelInterview } from "../../types";
import styles from "./CreatePanelDialog.module.css";

interface Props {
  storyId: string;
  onCreated: (panel: PanelInterview) => void;
  onClose: () => void;
}

export default function CreatePanelDialog({ storyId, onCreated, onClose }: Props) {
  const { characters } = useStoryStore();
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function toggleCharacter(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (selectedIds.length < 2) {
      setError("Select at least 2 characters.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const panel = await api.createPanel(storyId, {
        title: title.trim() || undefined,
        character_ids: selectedIds,
      });
      onCreated(panel);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create panel.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <Users size={15} className={styles.icon} />
          <h2 className={styles.title}>New Group Interview</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Confrontation at the docks"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Characters (select 2+)</label>
            <div className={styles.characterList}>
              {characters.map((c) => (
                <label key={c.id} className={`${styles.characterOption} ${selectedIds.includes(c.id) ? styles.selected : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCharacter(c.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles.avatar}>{c.name[0].toUpperCase()}</span>
                  <span className={styles.characterName}>{c.name}</span>
                  <span className={styles.characterRole}>{c.role}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={creating || selectedIds.length < 2}
            className={styles.createBtn}
          >
            {creating ? "Creating…" : "Start Interview"}
          </button>
        </div>
      </div>
    </div>
  );
}
