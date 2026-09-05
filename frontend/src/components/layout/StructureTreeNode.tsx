import { createElement, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, ChevronDown, Plus, GripVertical } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import { getSegmentIcon, segmentColor } from "./structureTreeMeta";
import styles from "./StructureTreePanel.module.css";

// Shared across every row so a drop knows what was picked up.
const dragState: { id: string | null } = { id: null };

type DropZone = "above" | "below" | "into" | null;

export default function NodeItem({
  node,
  depth = 0,
  storyId,
  onDrop,
  collapsed,
  toggleCollapsed,
  onRename,
  onKeyNav,
}: {
  node: StructureNode;
  depth?: number;
  storyId?: string;
  onDrop: (draggedId: string, targetId: string, zone: "above" | "below" | "into") => void;
  collapsed: Set<string>;
  toggleCollapsed: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onKeyNav: (e: React.KeyboardEvent, id: string) => void;
}) {
  const expanded = !collapsed.has(node.id);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [dropZone, setDropZone] = useState<DropZone>(null);

  const { activeNode, setActiveNode, activeTemplate, structure, setStructure } = useStoryStore();
  const navigate = useNavigate();
  const location = useLocation();
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeNode?.id === node.id;

  const childLevel = depth + 1;
  const childLevelDef = activeTemplate?.levels[childLevel];
  const canAddChild = !!childLevelDef && !!storyId;

  async function addChild() {
    if (!storyId || !childTitle.trim() || !childLevelDef) return;
    const created = await api.createNode(storyId, {
      title: childTitle.trim(),
      parent_id: node.id,
      level: childLevel,
      level_type: childLevelDef.name.toLowerCase(),
      position: node.children?.length ?? 0,
    });
    function insertChild(nodes: StructureNode[]): StructureNode[] {
      return nodes.map((n) =>
        n.id === node.id
          ? { ...n, children: [...(n.children ?? []), { ...created, children: [] }] }
          : { ...n, children: insertChild(n.children ?? []) },
      );
    }
    setStructure(insertChild(structure));
    if (!expanded) toggleCollapsed(node.id);
    setChildTitle("");
    setAddingChild(false);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function getZone(e: React.DragEvent): "above" | "below" | "into" {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    if (pct < 0.3) return "above";
    if (pct > 0.7) return "below";
    return hasChildren ? "into" : pct <= 0.5 ? "above" : "below";
  }

  function handleDragStart(e: React.DragEvent) {
    dragState.id = node.id;
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
    // Without stopPropagation — let parent know the drag started from a child
  }

  function handleDragOver(e: React.DragEvent) {
    if (!dragState.id || dragState.id === node.id) return;
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
    const id = e.dataTransfer.getData("text/plain") || dragState.id;
    dragState.id = null;
    const zone = getZone(e);
    setDropZone(null);
    if (!id || id === node.id) return;
    onDrop(id, node.id, zone);
  }

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          styles.nodeRowWrap,
          isActive ? styles.nodeRowWrapActive : "",
          dropZone === "above" ? styles.dropAbove : "",
          dropZone === "below" ? styles.dropBelow : "",
          dropZone === "into" ? styles.dropTarget : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        {/* Drag handle */}
        <span className={styles.dragHandle}>
          <GripVertical size={11} />
        </span>

        <button
          data-tree-node={node.id}
          onClick={() => {
            api.getNode(node.id).then(setActiveNode);
            if (!location.pathname.endsWith("/write")) {
              navigate(`/stories/${storyId}/write`);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setRenameValue(node.title);
            setRenaming(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "F2") {
              e.preventDefault();
              setRenameValue(node.title);
              setRenaming(true);
              return;
            }
            onKeyNav(e, node.id);
          }}
          className={styles.nodeRow}
          title="Enter opens · F2 or double-click renames · arrows move"
        >
          <span
            className={styles.chevron}
            onClick={
              hasChildren
                ? (e) => {
                    e.stopPropagation();
                    toggleCollapsed(node.id);
                  }
                : undefined
            }
            role={hasChildren ? "button" : undefined}
          >
            {hasChildren ? expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} /> : null}
          </span>
          {createElement(getSegmentIcon(node.level_type), {
            size: 12,
            className: styles.nodeTypeIcon,
            style: isActive ? undefined : { color: segmentColor(node.level_type) },
          })}
          {renaming ? (
            <input
              autoFocus
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  setRenaming(false);
                  if (renameValue.trim() && renameValue.trim() !== node.title)
                    onRename(node.id, renameValue.trim());
                }
                if (e.key === "Escape") setRenaming(false);
              }}
              onBlur={() => {
                setRenaming(false);
                if (renameValue.trim() && renameValue.trim() !== node.title)
                  onRename(node.id, renameValue.trim());
              }}
            />
          ) : (
            <span className={styles.nodeLabel}>{node.title}</span>
          )}
          {!renaming && node.word_count > 0 && (
            <span className={styles.nodeWordCount} title={`${node.word_count.toLocaleString()} words`}>
              {node.word_count >= 1000 ? `${(node.word_count / 1000).toFixed(1)}k` : node.word_count}
            </span>
          )}
          {node.status !== "draft" && (
            <span
              className={`${styles.nodeStatus} ${node.status === "final" ? styles.statusFinal : styles.statusRevised}`}
            >
              {node.status === "final" ? "✓" : "~"}
            </span>
          )}
        </button>

        {canAddChild && (
          <button
            className={styles.nodeAddChildBtn}
            onClick={(e) => {
              e.stopPropagation();
              setAddingChild((s) => !s);
              setChildTitle("");
            }}
            title={`Add ${childLevelDef.name}`}
          >
            <Plus size={11} />
          </button>
        )}
      </div>

      {addingChild && (
        <div style={{ paddingLeft: `${6 + (depth + 1) * 14}px` }} className={styles.childAddRow}>
          <input
            autoFocus
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addChild();
              if (e.key === "Escape") setAddingChild(false);
            }}
            onBlur={() => {
              if (!childTitle.trim()) setAddingChild(false);
            }}
            placeholder={`${childLevelDef!.name} title…`}
            className={styles.addInput}
          />
        </div>
      )}

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <NodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              storyId={storyId}
              onDrop={onDrop}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              onRename={onRename}
              onKeyNav={onKeyNav}
            />
          ))}
        </div>
      )}
    </div>
  );
}
