import { useState } from "react";
import { GripVertical, ChevronRight, ChevronDown, Plus, Trash2, FileText, Link, X } from "lucide-react";
import type { OutlineItem as OutlineItemType, StructureNode } from "../../types";
import styles from "./OutlineItem.module.css";

// Module-level drag ID — same pattern as StructureTreePanel
export let _draggedId: string | null = null;

type DropZone = "above" | "below" | "into" | null;

export interface OutlineItemProps {
  item: OutlineItemType;
  depth?: number;
  selected: Set<string>;
  selectionActive: boolean;
  onToggleSelect: (id: string) => void;
  onDrop: (draggedId: string, targetId: string, zone: "above" | "below" | "into") => void;
  onUpdate: (id: string, patch: Partial<Pick<OutlineItemType, "text" | "notes" | "beat_type" | "collapsed" | "scene_id" | "scene_title">>) => void;
  onDelete: (id: string) => void;
  onAddSibling: (afterId: string) => void;
  onAddChild: (parentId: string) => void;
  onIndent: (id: string) => void;
  onDedent: (id: string) => void;
  focusId?: string | null;
  sceneNodes?: StructureNode[];
  onNavigateToScene?: (sceneId: string) => void;
}

export default function OutlineItem({
  item,
  depth = 0,
  selected,
  selectionActive,
  onToggleSelect,
  onDrop,
  onUpdate,
  onDelete,
  onAddSibling,
  onAddChild,
  onIndent,
  onDedent,
  focusId,
  sceneNodes = [],
  onNavigateToScene,
}: OutlineItemProps) {
  const [dropZone, setDropZone] = useState<DropZone>(null);
  const [collapsed, setCollapsed] = useState(item.collapsed);
  const [focused, setFocused] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);

  const isSelected = selected.has(item.id);
  const hasChildren = (item.children?.length ?? 0) > 0;

  // ── Zone detection ─────────────────────────────────────────────────────────

  function getZone(e: React.DragEvent): "above" | "below" | "into" {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    if (pct < 0.3) return "above";
    if (pct > 0.7) return "below";
    return "into";
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent) {
    // Don't start drag from inputs/textareas
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      e.preventDefault();
      return;
    }
    _draggedId = item.id;
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    if (!_draggedId || _draggedId === item.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropZone(getZone(e));
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || _draggedId;
    _draggedId = null;
    const zone = getZone(e);
    setDropZone(null);
    if (!id || id === item.id) return;
    onDrop(id, item.id, zone);
  }

  function handleDragEnd() {
    _draggedId = null;
    setDropZone(null);
  }

  // ── Beat type cycling ──────────────────────────────────────────────────────

  const beatTypes: Array<OutlineItemType["beat_type"]> = [null, "plot", "character", "theme", "setting"];

  function cycleBeatType() {
    const idx = beatTypes.indexOf(item.beat_type);
    const next = beatTypes[(idx + 1) % beatTypes.length];
    onUpdate(item.id, { beat_type: next });
  }

  // ── Collapse toggle ────────────────────────────────────────────────────────

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    onUpdate(item.id, { collapsed: next });
  }

  // ── Class assembly ─────────────────────────────────────────────────────────

  const beatClass = item.beat_type ? (styles as Record<string, string>)[item.beat_type] ?? "" : styles.none;

  const rowClass = [
    styles.row,
    focused ? styles.rowFocused : "",
    isSelected ? styles.rowSelected : "",
    selectionActive ? styles.rowSelectionActive : "",
    dropZone === "above" ? styles.dropAbove : "",
    dropZone === "below" ? styles.dropBelow : "",
    dropZone === "into" ? styles.dropInto : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={styles.item}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        className={rowClass}
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        {/* Drag grip — left */}
        <span className={styles.dragGrip}>
          <GripVertical size={13} />
        </span>

        {/* Collapse toggle */}
        {hasChildren ? (
          <button className={styles.collapseToggle} onClick={toggleCollapse} tabIndex={-1}>
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <span className={styles.collapsePlaceholder} />
        )}

        {/* Beat type dot */}
        <button
          className={`${styles.beatDot} ${beatClass}`}
          onClick={cycleBeatType}
          title={item.beat_type ? item.beat_type : "No type — click to set"}
          tabIndex={-1}
        />

        {/* Content */}
        <div className={styles.content}>
          <input
            className={styles.textInput}
            value={item.text}
            autoFocus={focusId === item.id}
            data-outline-input
            onChange={(e) => onUpdate(item.id, { text: e.target.value })}
            onKeyDown={(e) => {
              const input = e.target as HTMLInputElement;
              if (e.key === "Enter") {
                e.preventDefault();
                onAddSibling(item.id);
              } else if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                onIndent(item.id);
              } else if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault();
                onDedent(item.id);
              } else if (e.key === "ArrowUp" && input.selectionStart === 0 && input.selectionEnd === 0) {
                e.preventDefault();
                const all = Array.from(document.querySelectorAll<HTMLInputElement>("[data-outline-input]"));
                const idx = all.indexOf(input);
                if (idx > 0) { all[idx - 1].focus(); all[idx - 1].setSelectionRange(0, 0); }
              } else if (e.key === "ArrowDown" && input.selectionStart === input.value.length) {
                e.preventDefault();
                const all = Array.from(document.querySelectorAll<HTMLInputElement>("[data-outline-input]"));
                const idx = all.indexOf(input);
                if (idx < all.length - 1) { all[idx + 1].focus(); all[idx + 1].setSelectionRange(0, 0); }
              }
            }}
            placeholder="Outline beat…"
          />
          {item.scene_id && !showScenePicker && (
            <div
              className={styles.sceneLink}
              onClick={() => onNavigateToScene?.(item.scene_id!)}
              style={{ cursor: onNavigateToScene ? "pointer" : "default" }}
            >
              <Link size={10} />
              <span>{item.scene_title || "Linked scene"}</span>
              <button
                className={styles.sceneLinkRemove}
                onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { scene_id: null, scene_title: null }); }}
                tabIndex={-1}
              >
                <X size={10} />
              </button>
            </div>
          )}
          {showScenePicker && (
            <select
              className={styles.scenePicker}
              value={item.scene_id ?? ""}
              autoFocus
              onChange={(e) => {
                const node = sceneNodes.find((n) => n.id === e.target.value);
                onUpdate(item.id, {
                  scene_id: e.target.value || null,
                  scene_title: node?.title ?? null,
                });
                setShowScenePicker(false);
              }}
              onBlur={() => setShowScenePicker(false)}
            >
              <option value="">— unlink —</option>
              {sceneNodes.map((n) => (
                <option key={n.id} value={n.id}>{n.title || "Untitled"}</option>
              ))}
            </select>
          )}
          {showNotes && (
            <textarea
              className={styles.notesInput}
              value={item.notes}
              onChange={(e) => onUpdate(item.id, { notes: e.target.value })}
              placeholder="Notes…"
              rows={2}
            />
          )}
          {!showNotes && item.notes && (
            <p className={styles.notesPreview} onClick={() => setShowNotes(true)}>
              {item.notes}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          {sceneNodes.length > 0 && (
            <button
              className={`${styles.actionBtn} ${item.scene_id ? styles.actionBtnActive : ""}`}
              onClick={() => setShowScenePicker((v) => !v)}
              title={item.scene_id ? `Linked: ${item.scene_title}` : "Link to scene"}
              tabIndex={-1}
            >
              <Link size={13} />
            </button>
          )}
          <button
            className={`${styles.actionBtn} ${showNotes ? styles.actionBtnActive : ""}`}
            onClick={() => setShowNotes((v) => !v)}
            title="Toggle notes"
            tabIndex={-1}
          >
            <FileText size={13} />
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => onAddChild(item.id)}
            title="Add child"
            tabIndex={-1}
          >
            <Plus size={13} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.danger}`}
            onClick={() => onDelete(item.id)}
            title="Delete"
            tabIndex={-1}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Select checkbox — right */}
        <label
          className={styles.selectWrap}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className={styles.selectBox}
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
            tabIndex={-1}
          />
        </label>
      </div>

      {/* Children */}
      {!collapsed && hasChildren && (
        <div className={styles.children}>
          {item.children.map((child) => (
            <OutlineItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selected={selected}
              selectionActive={selectionActive}
              onToggleSelect={onToggleSelect}
              onDrop={onDrop}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddSibling={onAddSibling}
              onAddChild={onAddChild}
              onIndent={onIndent}
              onDedent={onDedent}
              focusId={focusId}
              sceneNodes={sceneNodes}
              onNavigateToScene={onNavigateToScene}
            />
          ))}
        </div>
      )}
    </div>
  );
}
