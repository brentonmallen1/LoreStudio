import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Plus, PanelLeftClose, List, Share2, FileText, BookOpen, CheckSquare } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import type { StructureNode } from "../../types";
import NodeItem from "./StructureTreeNode";
import {
  findNode,
  flattenPositions,
  getSegmentIcon,
  loadCollapsed,
  reorderInTree,
  saveCollapsed,
  segmentColor,
  visibleIds,
} from "./structureTreeMeta";
import styles from "./StructureTreePanel.module.css";

// ── Panel ─────────────────────────────────────────────────────────────────────

interface StructureTreePanelProps {
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
  overlay?: boolean;
}

export default function StructureTreePanel({ onMouseLeave, onMouseEnter, overlay }: StructureTreePanelProps) {
  const { storyId } = useParams<{ storyId: string }>();
  const { structure, setStructure, activeTemplate, activeNode } = useStoryStore();
  const { treePanelWidth, setTreePanelWidth, setTreeDetached, viewMode, setViewMode } = useUIStore();

  const [addingLevel, setAddingLevel] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [collapsedState, setCollapsedState] = useState<{ storyId: string | undefined; ids: Set<string> }>(
    () => ({
      storyId,
      ids: loadCollapsed(storyId),
    }),
  );
  const collapsed = collapsedState.storyId === storyId ? collapsedState.ids : loadCollapsed(storyId);

  function toggleCollapsed(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveCollapsed(storyId, next);
    setCollapsedState({ storyId, ids: next });
  }

  async function renameNode(id: string, title: string) {
    await api.updateNode(id, { title });
    const patch = (nodes: StructureNode[]): StructureNode[] =>
      nodes.map((n) => (n.id === id ? { ...n, title } : { ...n, children: patch(n.children ?? []) }));
    setStructure(patch(structureRef.current));
    if (activeNode?.id === id) useStoryStore.getState().setActiveNode({ ...activeNode, title });
  }

  /** Arrow keys move between rows, Left/Right collapse/expand, Enter opens. */
  function handleKeyNav(e: React.KeyboardEvent, id: string) {
    const ids = visibleIds(structureRef.current, collapsed);
    const idx = ids.indexOf(id);
    const focus = (targetId: string | undefined) => {
      if (!targetId) return;
      const el = document.querySelector<HTMLElement>(`[data-tree-node="${targetId}"]`);
      el?.focus();
    };
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focus(ids[idx + 1]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focus(ids[idx - 1]);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const node = findNode(structureRef.current, id);
      if (!node?.children?.length) return;
      const isCollapsed = collapsed.has(id);
      if ((e.key === "ArrowRight" && isCollapsed) || (e.key === "ArrowLeft" && !isCollapsed)) {
        e.preventDefault();
        toggleCollapsed(id);
      }
    }
  }

  // Stale-closure-safe refs for onDrop callbacks
  const structureRef = useRef(structure);
  const storyIdRef = useRef(storyId);
  useEffect(() => {
    structureRef.current = structure;
    storyIdRef.current = storyId;
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function insertNodeIntoTree(
    nodes: StructureNode[],
    parentId: string,
    newNode: StructureNode,
  ): StructureNode[] {
    return nodes.map((n) =>
      n.id === parentId
        ? { ...n, children: [...(n.children ?? []), newNode] }
        : { ...n, children: insertNodeIntoTree(n.children ?? [], parentId, newNode) },
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
    function onMouseUp() {
      isResizing.current = false;
    }
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
              onClick={() => {
                setShowAddMenu((v) => !v);
                setAddingLevel(null);
                setNewTitle("");
              }}
              title="Add structure node"
            >
              <Plus size={12} />
            </button>
            {showAddMenu && (
              <div className={styles.addMenu}>
                {activeTemplate?.levels.map((level, idx) => {
                  const enabled = idx === 0 || activeNode?.level === idx - 1;
                  const hint =
                    idx > 0 && !enabled ? `Select a ${activeTemplate.levels[idx - 1].name} first` : undefined;
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
            title="Hide the structure tree"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>
      </div>

      {/* View mode toggle */}
      <div className={styles.viewToggle}>
        <button
          className={`${styles.viewBtn} ${viewMode === "tree" ? styles.viewActive : ""}`}
          onClick={() => setViewMode("tree")}
          title="Tree view"
        >
          <List size={12} />
        </button>
        <button
          className={`${styles.viewBtn} ${viewMode === "storyboard" ? styles.viewActive : ""}`}
          onClick={() => setViewMode("storyboard")}
          title="Storyboard view"
        >
          <Share2 size={12} />
        </button>
        <button
          className={`${styles.viewBtn} ${viewMode === "summary" ? styles.viewActive : ""}`}
          onClick={() => setViewMode("summary")}
          title="Summary overview"
        >
          <FileText size={12} />
        </button>
        <button
          className={`${styles.viewBtn} ${viewMode === "manuscript" ? styles.viewActive : ""}`}
          onClick={() => setViewMode("manuscript")}
          title="Manuscript view"
        >
          <BookOpen size={12} />
        </button>
        <button
          className={`${styles.viewBtn} ${viewMode === "todos" ? styles.viewActive : ""}`}
          onClick={() => setViewMode("todos")}
          title="TODOs"
          style={viewMode === "todos" ? {} : { color: "var(--color-todo)" }}
        >
          <CheckSquare size={12} />
        </button>
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
              onBlur={() => {
                if (!newTitle.trim()) setAddingLevel(null);
              }}
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
          <NodeItem
            key={node.id}
            node={node}
            storyId={storyId}
            onDrop={handleDrop}
            collapsed={collapsed}
            toggleCollapsed={toggleCollapsed}
            onRename={renameNode}
            onKeyNav={handleKeyNav}
          />
        ))}
      </div>
    </div>
  );
}
