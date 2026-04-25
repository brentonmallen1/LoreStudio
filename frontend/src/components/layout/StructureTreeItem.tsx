import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  GripVertical,
  Flag,
  BookMarked,
  Clapperboard,
  Layers,
  Zap,
  Puzzle,
  Milestone,
  type LucideIcon,
} from "lucide-react";
import type { ItemInstance } from "@headless-tree/core";
import type { StructureNode, StoryStructureTemplate } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import { useHistoryStore } from "../../stores/historyStore";
import { api } from "../../api/client";
import { applyChildrenMap, computeOps } from "./useStructureTree";
import styles from "./StructureTreePanel.module.css";

const SEGMENT_ICONS: Record<string, LucideIcon> = {
  act: Flag,
  chapter: BookMarked,
  scene: Clapperboard,
  section: Layers,
  beat: Zap,
  part: Puzzle,
  stage: Milestone,
};

function getSegmentIcon(levelType: string): LucideIcon {
  return SEGMENT_ICONS[levelType.toLowerCase()] ?? Layers;
}

function segmentColor(levelType: string): string {
  const key = levelType.toLowerCase();
  const known = ["act", "chapter", "scene", "section", "beat", "part", "stage"];
  // Blend 65% segment color with 35% muted text — keeps types distinct without full-saturation rainbow
  return known.includes(key)
    ? `color-mix(in srgb, var(--segment-${key}) 65%, var(--color-text-subtle))`
    : "var(--color-text-subtle)";
}

// Module-level dragged ID so all sibling instances can see it
let _draggedId: string | null = null;

type DropZone = "above" | "below" | "into" | null;

interface Props {
  item: ItemInstance<StructureNode>;
  storyId: string | undefined;
  activeTemplate: StoryStructureTemplate | null;
  childrenMapRef: React.RefObject<Record<string, string[]>>;
  itemMapRef: React.RefObject<Record<string, StructureNode>>;
  prevStructureRef: React.RefObject<StructureNode[]>;
  setChildrenMap: (m: Record<string, string[]>) => void;
}

export default function StructureTreeItem({
  item,
  storyId,
  activeTemplate,
  childrenMapRef,
  itemMapRef,
  prevStructureRef,
  setChildrenMap,
}: Props) {
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [dropZone, setDropZone] = useState<DropZone>(null);

  const { activeNode, setActiveNode, structure, setStructure } = useStoryStore();
  const pushHistory = useHistoryStore((s) => s.push);
  const navigate = useNavigate();
  const location = useLocation();

  const node = item.getItemData();
  const meta = item.getItemMeta();
  const isActive = activeNode?.id === node?.id;
  const isFolder = item.isFolder();
  const isExpanded = item.isExpanded();

  if (!node || !node.level_type) return null;

  const depth = meta.level - 1;
  const childLevel = depth + 1;
  const childLevelDef = activeTemplate?.levels[childLevel];
  const canAddChild = !!childLevelDef && !!storyId;
  const hasChildren = (childrenMapRef.current[node.id] ?? []).length > 0;

  async function addChild() {
    if (!storyId || !childTitle.trim() || !childLevelDef) return;
    const created = await api.createNode(storyId, {
      title: childTitle.trim(),
      parent_id: node.id,
      level: childLevel,
      level_type: childLevelDef.name.toLowerCase(),
      position: (node.children?.length ?? 0),
    });
    function insertChild(nodes: StructureNode[]): StructureNode[] {
      return nodes.map((n) =>
        n.id === node.id
          ? { ...n, children: [...(n.children ?? []), { ...created, children: [] }] }
          : { ...n, children: insertChild(n.children ?? []) }
      );
    }
    setStructure(insertChild(structure));
    if (!isExpanded) item.expand();
    setChildTitle("");
    setAddingChild(false);
  }

  // ── Drag ───────────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent) {
    _draggedId = node.id;
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function getDropZone(e: React.DragEvent): DropZone {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    if (pct < 0.33) return "above";
    if (pct > 0.67) return "below";
    return hasChildren ? "into" : (pct < 0.5 ? "above" : "below");
  }

  function handleDragOver(e: React.DragEvent) {
    if (!_draggedId || _draggedId === node.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropZone(getDropZone(e));
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving this element (not entering a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain") || _draggedId;
    _draggedId = null;
    const zone = getDropZone(e);
    setDropZone(null);

    if (!draggedId || draggedId === node.id || !storyId) return;

    const oldMap = childrenMapRef.current;
    const im = itemMapRef.current;

    // Build new map
    const newMap: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(oldMap)) {
      newMap[k] = v.filter((id) => id !== draggedId);
    }

    if (zone === "into") {
      // Drop as last child of this node
      if (!newMap[node.id]) newMap[node.id] = [];
      newMap[node.id] = [...newMap[node.id], draggedId];
    } else {
      // Find parent by scanning childrenMap (node.id appears in exactly one parent's list)
      const parentId =
        Object.keys(oldMap).find((pid) => oldMap[pid].includes(node.id)) ?? "root";

      const siblings = [...(newMap[parentId] ?? [])];
      const targetIdx = siblings.indexOf(node.id);
      const insertAt = zone === "above" ? targetIdx : targetIdx + 1;
      siblings.splice(insertAt, 0, draggedId);
      newMap[parentId] = siblings;
    }

    // Ensure dragged node still has its children entry
    if (!newMap[draggedId]) newMap[draggedId] = oldMap[draggedId] ?? [];

    const ops = computeOps(newMap);
    const newStructure = applyChildrenMap(newMap, im);
    const snapshotStructure = prevStructureRef.current;
    const snapshotMap = oldMap;

    pushHistory({
      description: "Reorder sections",
      undo: async () => {
        const undoOps = computeOps(snapshotMap);
        setChildrenMap(snapshotMap);
        prevStructureRef.current = snapshotStructure;
        setStructure(snapshotStructure);
        await api.reorderStructure(storyId!, undoOps);
      },
    });

    // Optimistic update
    setChildrenMap(newMap);
    prevStructureRef.current = newStructure;
    setStructure(newStructure);

    try {
      await api.reorderStructure(storyId, ops);
    } catch {
      setChildrenMap(snapshotMap);
      prevStructureRef.current = snapshotStructure;
      setStructure(snapshotStructure);
    }
  }

  function moveNode(direction: -1 | 1) {
    if (!storyId) return;
    const oldMap = childrenMapRef.current;
    const im = itemMapRef.current;
    const parentId = Object.keys(oldMap).find((pid) => oldMap[pid].includes(node.id)) ?? "root";
    const siblings = [...(oldMap[parentId] ?? [])];
    const idx = siblings.indexOf(node.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    [siblings[idx], siblings[newIdx]] = [siblings[newIdx], siblings[idx]];
    const newMap = { ...oldMap, [parentId]: siblings };
    const ops = computeOps(newMap);
    const newStructure = applyChildrenMap(newMap, im);
    const snapshotStructure = prevStructureRef.current;
    const snapshotMap = oldMap;
    pushHistory({
      description: "Reorder sections",
      undo: async () => {
        setChildrenMap(snapshotMap);
        prevStructureRef.current = snapshotStructure;
        setStructure(snapshotStructure);
        await api.reorderStructure(storyId!, computeOps(snapshotMap));
      },
    });
    setChildrenMap(newMap);
    prevStructureRef.current = newStructure;
    setStructure(newStructure);
    api.reorderStructure(storyId, ops).catch(() => {
      setChildrenMap(snapshotMap);
      prevStructureRef.current = snapshotStructure;
      setStructure(snapshotStructure);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!e.altKey) return;
    if (e.key === "ArrowUp") { e.preventDefault(); moveNode(-1); }
    if (e.key === "ArrowDown") { e.preventDefault(); moveNode(1); }
  }

  const Icon = getSegmentIcon(node.level_type);
  const itemProps = item.getProps();

  return (
    <>
      <div
        ref={itemProps.ref as React.Ref<HTMLDivElement>}
        role={itemProps.role}
        aria-label={itemProps["aria-label"]}
        aria-level={itemProps["aria-level"]}
        aria-expanded={itemProps["aria-expanded"]}
        aria-setsize={itemProps["aria-setsize"]}
        aria-posinset={itemProps["aria-posinset"]}
        tabIndex={itemProps.tabIndex}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        className={[
          styles.nodeRowWrap,
          isActive ? styles.nodeRowWrapActive : "",
          dropZone === "into" ? styles.dropTarget : "",
          dropZone === "above" ? styles.dropAbove : "",
          dropZone === "below" ? styles.dropBelow : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        {/* Drag handle */}
        <span className={styles.dragHandle} title="Drag to reorder">
          <GripVertical size={11} />
        </span>

        {/* Expand/collapse toggle */}
        <span
          className={styles.chevron}
          onClick={isFolder ? (e) => { e.stopPropagation(); isExpanded ? item.collapse() : item.expand(); } : undefined}
          role={isFolder ? "button" : undefined}
        >
          {isFolder ? (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : null}
        </span>

        {/* Main clickable area */}
        <button
          className={styles.nodeRow}
          onClick={() => {
            api.getNode(node.id).then(setActiveNode);
            if (!location.pathname.endsWith("/write")) {
              navigate(`/stories/${storyId}/write`);
            }
          }}
        >
          <Icon
            size={12}
            className={styles.nodeTypeIcon}
            style={isActive ? undefined : { color: segmentColor(node.level_type) }}
          />
          <span className={styles.nodeLabel}>{node.title}</span>
          {node.status !== "draft" && (
            <span
              className={`${styles.nodeStatus} ${
                node.status === "final" ? styles.statusFinal : styles.statusRevised
              }`}
            >
              {node.status === "final" ? "✓" : "~"}
            </span>
          )}
        </button>

        {/* Add child button */}
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

      {/* Inline add input */}
      {addingChild && (
        <div
          style={{ paddingLeft: `${6 + (depth + 1) * 14}px` }}
          className={styles.childAddRow}
        >
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
    </>
  );
}
