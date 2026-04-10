import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  PanelLeftOpen,
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
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useHistoryStore } from "../../stores/historyStore";
import type { StructureNode } from "../../types";
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
  return known.includes(key) ? `var(--segment-${key})` : "var(--color-text-subtle)";
}

// ── Reorder helpers ────────────────────────────────────────────────────────────

function reorderInTree(
  nodes: StructureNode[],
  draggedId: string,
  targetId: string,
  zone: "above" | "below" | "into"
): StructureNode[] {
  // Extract dragged node from anywhere in the tree
  let dragged: StructureNode | null = null;

  function extract(list: StructureNode[]): StructureNode[] {
    return list.flatMap((n) => {
      if (n.id === draggedId) { dragged = n; return []; }
      return [{ ...n, children: extract(n.children ?? []) }];
    });
  }

  function insert(list: StructureNode[]): StructureNode[] {
    if (zone === "into") {
      return list.map((n) => {
        if (n.id === targetId) {
          return { ...n, children: [...(n.children ?? []), dragged!] };
        }
        return { ...n, children: insert(n.children ?? []) };
      });
    }
    // above / below: find target in this list, insert dragged next to it
    const idx = list.findIndex((n) => n.id === targetId);
    if (idx !== -1) {
      const copy = [...list];
      copy.splice(zone === "above" ? idx : idx + 1, 0, dragged!);
      return copy;
    }
    return list.map((n) => ({ ...n, children: insert(n.children ?? []) }));
  }

  const withoutDragged = extract(nodes);
  if (!dragged) return nodes; // dragged id not found, bail
  return insert(withoutDragged);
}

function flattenPositions(nodes: StructureNode[], parentId: string | null = null) {
  const ops: { node_id: string; parent_id: string | null; position: number }[] = [];
  nodes.forEach((n, i) => {
    ops.push({ node_id: n.id, parent_id: parentId, position: i });
    ops.push(...flattenPositions(n.children ?? [], n.id));
  });
  return ops;
}

// ── NodeItem ──────────────────────────────────────────────────────────────────

let _draggedId: string | null = null;

type DropZone = "above" | "below" | "into" | null;

function NodeItem({
  node,
  depth = 0,
  storyId,
  onDrop,
}: {
  node: StructureNode;
  depth?: number;
  storyId?: string;
  onDrop: (draggedId: string, targetId: string, zone: "above" | "below" | "into") => void;
}) {
  const [expanded, setExpanded] = useState(true);
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
          : { ...n, children: insertChild(n.children ?? []) }
      );
    }
    setStructure(insertChild(structure));
    if (!expanded) setExpanded(true);
    setChildTitle("");
    setAddingChild(false);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function getZone(e: React.DragEvent): "above" | "below" | "into" {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    if (pct < 0.3) return "above";
    if (pct > 0.7) return "below";
    return hasChildren ? "into" : (pct <= 0.5 ? "above" : "below");
  }

  function handleDragStart(e: React.DragEvent) {
    _draggedId = node.id;
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
    // Without stopPropagation — let parent know the drag started from a child
  }

  function handleDragOver(e: React.DragEvent) {
    if (!_draggedId || _draggedId === node.id) return;
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
    if (!id || id === node.id) return;
    onDrop(id, node.id, zone);
  }

  const Icon = getSegmentIcon(node.level_type);

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
        ].filter(Boolean).join(" ")}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        {/* Drag handle */}
        <span className={styles.dragHandle}>
          <GripVertical size={11} />
        </span>

        <button
          onClick={() => {
            setActiveNode(node);
            if (!location.pathname.endsWith("/write")) {
              navigate(`/stories/${storyId}/write`);
            }
          }}
          className={styles.nodeRow}
        >
          <span
            className={styles.chevron}
            onClick={hasChildren ? (e) => { e.stopPropagation(); setExpanded((x) => !x); } : undefined}
            role={hasChildren ? "button" : undefined}
          >
            {hasChildren ? (expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : null}
          </span>
          {(() => {
            return (
              <Icon
                size={12}
                className={styles.nodeTypeIcon}
                style={isActive ? undefined : { color: segmentColor(node.level_type) }}
              />
            );
          })()}
          <span className={styles.nodeLabel}>{node.title}</span>
          {node.status !== "draft" && (
            <span className={`${styles.nodeStatus} ${node.status === "final" ? styles.statusFinal : styles.statusRevised}`}>
              {node.status === "final" ? "✓" : "~"}
            </span>
          )}
        </button>

        {canAddChild && (
          <button
            className={styles.nodeAddChildBtn}
            onClick={(e) => { e.stopPropagation(); setAddingChild((s) => !s); setChildTitle(""); }}
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
            onBlur={() => { if (!childTitle.trim()) setAddingChild(false); }}
            placeholder={`${childLevelDef!.name} title…`}
            className={styles.addInput}
          />
        </div>
      )}

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <NodeItem key={child.id} node={child} depth={depth + 1} storyId={storyId} onDrop={onDrop} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface StructureTreePanelProps {
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
  overlay?: boolean;
}

export default function StructureTreePanel({ onMouseLeave, onMouseEnter, overlay }: StructureTreePanelProps) {
  const { storyId } = useParams<{ storyId: string }>();
  const { structure, setStructure, activeTemplate, activeNode } = useStoryStore();
  const { treePanelWidth, setTreePanelWidth, setTreeDetached } = useUIStore();
  const pushHistory = useHistoryStore((s) => s.push);

  const [addingLevel, setAddingLevel] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Stale-closure-safe refs for onDrop callbacks
  const structureRef = useRef(structure);
  structureRef.current = structure;
  const storyIdRef = useRef(storyId);
  storyIdRef.current = storyId;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function insertNodeIntoTree(nodes: StructureNode[], parentId: string, newNode: StructureNode): StructureNode[] {
    return nodes.map((n) =>
      n.id === parentId
        ? { ...n, children: [...(n.children ?? []), newNode] }
        : { ...n, children: insertNodeIntoTree(n.children ?? [], parentId, newNode) }
    );
  }

  async function addNode() {
    if (!storyId || !newTitle.trim() || addingLevel === null) return;
    const levelDef = activeTemplate?.levels[addingLevel];
    if (!levelDef) return;

    if (addingLevel === 0) {
      const node = await api.createNode(storyId, {
        title: newTitle.trim(),
        level: 0,
        level_type: levelDef.name.toLowerCase(),
        position: structure.length,
      });
      setStructure([...structure, { ...node, children: [] }]);
    } else {
      if (!activeNode) return;
      const node = await api.createNode(storyId, {
        title: newTitle.trim(),
        parent_id: activeNode.id,
        level: addingLevel,
        level_type: levelDef.name.toLowerCase(),
        position: activeNode.children?.length ?? 0,
      });
      setStructure(insertNodeIntoTree(structure, activeNode.id, { ...node, children: [] }));
    }
    setNewTitle("");
    setAddingLevel(null);
  }

  // Called by any NodeItem when a drop occurs
  function handleDrop(draggedId: string, targetId: string, zone: "above" | "below" | "into") {
    const prev = structureRef.current;
    const next = reorderInTree(prev, draggedId, targetId, zone);
    if (next === prev) return; // dragged not found, no-op

    const ops = flattenPositions(next);

    pushHistory({
      description: "Reorder sections",
      undo: async () => {
        setStructure(prev);
        await api.reorderStructure(storyIdRef.current!, flattenPositions(prev));
      },
    });

    setStructure(next);

    api.reorderStructure(storyIdRef.current!, ops).catch(() => {
      // Rollback on failure
      setStructure(prev);
    });
  }

  // Horizontal resize
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(treePanelWidth);

  function startResize(e: React.MouseEvent) {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = treePanelWidth;
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const dx = e.clientX - resizeStartX.current;
      const newWidth = Math.max(160, Math.min(500, resizeStartWidth.current + dx));
      setTreePanelWidth(newWidth);
    }
    function onMouseUp() { isResizing.current = false; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setTreePanelWidth]);

  return (
    <div
      className={`${styles.panel} ${overlay ? styles.panelOverlay : ""}`}
      style={{ width: treePanelWidth }}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      <div className={styles.resizeHandle} onMouseDown={startResize} />

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Structure</span>
        <div className={styles.headerRight}>
          <div className={styles.addMenuWrap} ref={addMenuRef}>
            <button
              className={`${styles.addBtn} ${showAddMenu ? styles.addBtnActive : ""}`}
              onClick={() => { setShowAddMenu((v) => !v); setAddingLevel(null); setNewTitle(""); }}
              title="Add structure node"
            >
              <Plus size={12} />
            </button>
            {showAddMenu && (
              <div className={styles.addMenu}>
                {activeTemplate?.levels.map((level, idx) => {
                  const enabled = idx === 0 || (activeNode?.level === idx - 1);
                  const hint = idx > 0 && !enabled
                    ? `Select a ${activeTemplate.levels[idx - 1].name} first`
                    : undefined;
                  const Icon = getSegmentIcon(level.name.toLowerCase());
                  return (
                    <button
                      key={level.name}
                      className={`${styles.addMenuItem} ${!enabled ? styles.addMenuItemDisabled : ""}`}
                      onClick={() => {
                        if (!enabled) return;
                        setAddingLevel(idx);
                        setNewTitle("");
                        setShowAddMenu(false);
                      }}
                      title={hint}
                      disabled={!enabled}
                    >
                      <Icon size={11} style={{ color: segmentColor(level.name.toLowerCase()) }} />
                      <span>Add {level.name}</span>
                      {hint && <span className={styles.addMenuHint}>{hint}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            className={styles.dockBtn}
            onClick={() => setTreeDetached(false)}
            title="Dock back to sidebar"
          >
            <PanelLeftOpen size={13} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className={styles.tree}>
        {addingLevel !== null && (
          <div className={styles.addInlineRow}>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNode();
                if (e.key === "Escape") setAddingLevel(null);
              }}
              onBlur={() => { if (!newTitle.trim()) setAddingLevel(null); }}
              placeholder={
                addingLevel === 0
                  ? `${activeTemplate?.levels[0]?.name ?? "Section"} title…`
                  : `${activeTemplate?.levels[addingLevel]?.name ?? "Node"} title (under "${activeNode?.title}")…`
              }
              className={styles.addInput}
            />
          </div>
        )}
        {structure.length === 0 && addingLevel === null && (
          <p className={styles.emptyHint}>No sections yet</p>
        )}
        {structure.map((node) => (
          <NodeItem key={node.id} node={node} storyId={storyId} onDrop={handleDrop} />
        ))}
      </div>
    </div>
  );
}
