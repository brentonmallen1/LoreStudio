import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import type { OutlineItem as OutlineItemType, OutlineBeatType } from "../../types";
import styles from "./OutlineItem.module.css";

const BEAT_TYPES: { value: OutlineBeatType; label: string }[] = [
  { value: "plot", label: "Plot" },
  { value: "character", label: "Character" },
  { value: "theme", label: "Theme" },
  { value: "setting", label: "Setting" },
];

interface Props {
  item: OutlineItemType;
  siblings: OutlineItemType[];
  onSave: (id: string, text: string, beatType: OutlineBeatType | null, notes: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddChild: (parentId: string) => Promise<string>;
  onAddSibling: (afterId: string, parentId: string | null) => Promise<string>;
  onIndent: (itemId: string) => Promise<void>;
  onOutdent: (itemId: string) => Promise<void>;
  onCollapse: (id: string, collapsed: boolean) => void;
  onReorder: (parentId: string | null, itemIds: string[]) => Promise<void>;
  autoFocus?: boolean;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
}

export default function OutlineItem({
  item,
  siblings,
  onSave,
  onDelete,
  onAddChild,
  onAddSibling,
  onIndent,
  onOutdent,
  onCollapse,
  onReorder,
  autoFocus,
  focusedId,
  setFocusedId,
}: Props) {
  const isEditing = focusedId === item.id;
  const [editText, setEditText] = useState(item.text);
  const [editBeatType, setEditBeatType] = useState<OutlineBeatType | null>(item.beat_type);
  const [editNotes, setEditNotes] = useState(item.notes);
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const [dragOver, setDragOver] = useState<"above" | "below" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragItemRef = useRef<string | null>(null);

  // Sync local edit state when item changes from outside
  useEffect(() => {
    if (!isEditing) {
      setEditText(item.text);
      setEditBeatType(item.beat_type);
      setEditNotes(item.notes);
    }
  }, [item.text, item.beat_type, item.notes, isEditing]);

  useEffect(() => {
    if ((isEditing || autoFocus) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, autoFocus]);

  function startEdit() {
    setEditText(item.text);
    setEditBeatType(item.beat_type);
    setEditNotes(item.notes);
    setShowNotes(!!item.notes);
    setFocusedId(item.id);
  }

  async function handleSave() {
    setFocusedId(null);
    await onSave(item.id, editText, editBeatType, editNotes);
  }

  function handleCancel() {
    setEditText(item.text);
    setEditBeatType(item.beat_type);
    setEditNotes(item.notes);
    setFocusedId(null);
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await onSave(item.id, editText, editBeatType, editNotes);
      const newId = await onAddSibling(item.id, item.parent_id);
      setFocusedId(newId);
    } else if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      await onSave(item.id, editText, editBeatType, editNotes);
      if (e.shiftKey) {
        await onOutdent(item.id);
      } else {
        await onIndent(item.id);
      }
      setFocusedId(item.id);
    }
  }

  // ── Drag reorder ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent) {
    dragItemRef.current = item.id;
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOver(e.clientY < midY ? "above" : "below");
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    setDragOver(null);
    if (!draggedId || draggedId === item.id) return;

    // Only reorder within same parent
    const draggedItem = siblings.find((s) => s.id === draggedId);
    if (!draggedItem) return;

    const ordered = siblings.filter((s) => s.id !== draggedId);
    const dropIdx = ordered.findIndex((s) => s.id === item.id);
    const insertAt = dragOver === "above" ? dropIdx : dropIdx + 1;
    ordered.splice(insertAt, 0, draggedItem);
    await onReorder(item.parent_id, ordered.map((s) => s.id));
  }

  const hasChildren = item.children && item.children.length > 0;
  const collapsed = item.collapsed;

  return (
    <div className={styles.item}>
      <div
        className={[
          styles.row,
          dragOver === "above" ? styles.dropAbove : "",
          dragOver === "below" ? styles.dropBelow : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag handle */}
        <span className={styles.dragHandle}>
          <GripVertical size={14} />
        </span>

        {/* Collapse toggle */}
        {hasChildren ? (
          <button
            className={styles.collapseToggle}
            onClick={() => onCollapse(item.id, !collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className={styles.collapsePlaceholder} />
        )}

        {/* Beat type dot */}
        <span className={`${styles.beatDot} ${styles[item.beat_type ?? "none"]}`} />

        {/* Content */}
        <div className={styles.textWrap} onClick={!isEditing ? startEdit : undefined}>
          {isEditing ? (
            <>
              <input
                ref={inputRef}
                className={styles.textInput}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Outline beat…"
              />
              <div className={styles.beatTypeRow}>
                <select
                  className={styles.beatTypeSelect}
                  value={editBeatType ?? ""}
                  onChange={(e) =>
                    setEditBeatType((e.target.value as OutlineBeatType) || null)
                  }
                >
                  <option value="">No type</option>
                  {BEAT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {!showNotes && (
                  <button
                    className={styles.actionBtn}
                    onClick={() => setShowNotes(true)}
                    title="Add notes"
                  >
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-subtle)" }}>
                      + notes
                    </span>
                  </button>
                )}
              </div>
              {showNotes && (
                <textarea
                  className={styles.notesInput}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes…"
                  rows={2}
                />
              )}
              <div className={styles.editActions}>
                <button className="btn btn-xs btn-primary" onClick={handleSave}>
                  Save
                </button>
                <button className="btn btn-xs" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <span className={`${styles.text} ${!item.text ? styles.empty : ""}`}>
                {item.text || "Untitled beat"}
              </span>
              {item.beat_type && (
                <span className={`${styles.beatBadge} ${styles[item.beat_type]}`}>
                  {item.beat_type}
                </span>
              )}
              {item.notes && (
                <span className={styles.notesText}>{item.notes}</span>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              title="Add child beat"
              onClick={async () => {
                const newId = await onAddChild(item.id);
                setFocusedId(newId);
              }}
            >
              <Plus size={13} />
            </button>
            <button
              className={`${styles.actionBtn} ${styles.danger}`}
              title="Delete"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className={styles.children}>
          {item.children.map((child) => (
            <OutlineItem
              key={child.id}
              item={child}
              siblings={item.children}
              onSave={onSave}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onAddSibling={onAddSibling}
              onIndent={onIndent}
              onOutdent={onOutdent}
              onCollapse={onCollapse}
              onReorder={onReorder}
              focusedId={focusedId}
              setFocusedId={setFocusedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
