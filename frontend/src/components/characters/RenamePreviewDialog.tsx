import { useState } from "react";
import { RefreshCw, CheckSquare, Square } from "lucide-react";
import { api } from "../../api/client";
import type { Character, RenamePreviewResponse } from "../../types";
import { Modal } from "../common";
import styles from "./RenamePreviewDialog.module.css";

interface Props {
  characterId: string;
  preview: RenamePreviewResponse;
  onApplied: (saved: Character) => void;
  onSkip: () => void;
}

export default function RenamePreviewDialog({ characterId, preview, onApplied, onSkip }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(preview.affected_scenes.map((s) => s.node_id)),
  );
  const [applying, setApplying] = useState(false);

  function toggleAll() {
    if (selected.size === preview.affected_scenes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(preview.affected_scenes.map((s) => s.node_id)));
    }
  }

  function toggleOne(nodeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  async function handleApply() {
    setApplying(true);
    try {
      const saved = await api.applyCharacterRename(
        characterId,
        preview.old_name,
        preview.new_name,
        Array.from(selected),
      );
      onApplied(saved);
    } finally {
      setApplying(false);
    }
  }

  const footer = (
    <>
      <button className={styles.skipBtn} onClick={onSkip} disabled={applying}>
        Skip, rename only
      </button>
      <button className={styles.applyBtn} onClick={handleApply} disabled={applying || selected.size === 0}>
        {applying ? "Applying…" : `Update ${selected.size} scene${selected.size !== 1 ? "s" : ""}`}
      </button>
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onSkip}
      title={`Rename "${preview.old_name}" to "${preview.new_name}"`}
      icon={<RefreshCw size={15} />}
      size="md"
      footer={footer}
    >
      <div className={styles.body}>
        <p className={styles.intro}>
          Found <strong>{preview.total_occurrences}</strong> mention
          {preview.total_occurrences !== 1 ? "s" : ""} across{" "}
          <strong>{preview.affected_scenes.length}</strong> scene
          {preview.affected_scenes.length !== 1 ? "s" : ""}. Select which scenes to update.
        </p>

        <div className={styles.toolbar}>
          <button className={styles.selectAllBtn} onClick={toggleAll}>
            {selected.size === preview.affected_scenes.length ? (
              <CheckSquare size={13} />
            ) : (
              <Square size={13} />
            )}
            {selected.size === preview.affected_scenes.length ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className={styles.list}>
          {preview.affected_scenes.map((scene) => (
            <div
              key={scene.node_id}
              className={`${styles.row} ${selected.has(scene.node_id) ? styles.rowSelected : ""}`}
            >
              <button
                className={styles.checkbox}
                onClick={() => toggleOne(scene.node_id)}
                aria-label={selected.has(scene.node_id) ? "Deselect" : "Select"}
              >
                {selected.has(scene.node_id) ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <div className={styles.rowContent}>
                <div className={styles.rowTitle}>
                  {scene.node_title}
                  <span className={styles.count}>
                    {scene.occurrences} mention{scene.occurrences !== 1 ? "s" : ""}
                  </span>
                </div>
                {scene.excerpt && <p className={styles.excerpt}>{scene.excerpt}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
