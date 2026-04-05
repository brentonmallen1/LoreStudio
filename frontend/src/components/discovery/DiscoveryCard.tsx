import { useState } from "react";
import type { DiscoveredElement } from "../../types";
import styles from "./DiscoveryCard.module.css";

const TYPE_ICONS: Record<string, string> = {
  character: "👤",
  setting: "📍",
  relationship: "🔗",
  theme: "💡",
  object: "📦",
};

const TYPE_LABELS: Record<string, string> = {
  character: "Character",
  setting: "Setting",
  relationship: "Relationship",
  theme: "Theme",
  object: "Object",
};

// Auto-creates in Lorebook on approve
const AUTO_CREATE_TYPES = new Set(["character", "setting"]);

function ConfidenceDots({ value }: { value: number }) {
  const level = value >= 0.85 ? 3 : value >= 0.65 ? 2 : 1;
  const label = level === 3 ? "High" : level === 2 ? "Medium" : "Low";
  return (
    <div className={styles.confidence}>
      <div className={styles.confidenceDots}>
        {[1, 2, 3].map(i => (
          <span key={i} className={`${styles.dot} ${i <= level ? styles.dotFilled : ""}`} />
        ))}
      </div>
      <span className={styles.confidenceLabel}>{label}</span>
    </div>
  );
}

interface Props {
  element: DiscoveredElement;
  onApprove: (id: string, overrides?: { name?: string; description?: string }) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export default function DiscoveryCard({ element, onApprove, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(element.name);
  const [editDesc, setEditDesc] = useState(element.description);

  async function handleApprove() {
    await onApprove(element.id);
  }

  async function handleEditApprove() {
    await onApprove(element.id, { name: editName, description: editDesc });
  }

  async function handleReject() {
    await onReject(element.id);
  }

  const autoCreates = AUTO_CREATE_TYPES.has(element.element_type);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.typeIcon}>{TYPE_ICONS[element.element_type] ?? "❓"}</span>
        <div className={styles.headerText}>
          <p className={styles.name}>{element.name}</p>
          <span className={styles.typeBadge}>{TYPE_LABELS[element.element_type] ?? element.element_type}</span>
        </div>
        <ConfidenceDots value={element.confidence} />
      </div>

      {element.description && (
        <p className={styles.description}>{element.description}</p>
      )}

      {element.source_excerpt && (
        <p className={styles.excerpt}>"{element.source_excerpt}"</p>
      )}

      {editing ? (
        <div className={styles.editArea}>
          <label className={styles.editLabel}>Edit before adding</label>
          <input
            className={styles.editInput}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Name"
          />
          <textarea
            className={styles.editTextarea}
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="Description"
            rows={2}
          />
          <div className={styles.editActions}>
            <button className={styles.confirmBtn} onClick={handleEditApprove} disabled={!editName.trim()}>
              Add to Lorebook
            </button>
            <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={styles.approveBtn} onClick={handleApprove}>
            {autoCreates ? "Add to Lorebook" : "Accept"}
          </button>
          <button className={styles.rejectBtn} onClick={() => setEditing(true)}>Edit & Add</button>
          <button className={styles.rejectBtn} onClick={handleReject}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
