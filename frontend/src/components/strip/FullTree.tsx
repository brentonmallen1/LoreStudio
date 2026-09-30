import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import type { StructureNode } from "../../types";
import NodeItem from "../layout/StructureTreeNode";
import {
  findNode,
  flattenPositions,
  getSegmentIcon,
  loadCollapsed,
  parentForLevel,
  reorderInTree,
  saveCollapsed,
  segmentColor,
  visibleIds,
} from "../layout/structureTreeMeta";
import { filterTree } from "../../lib/strip/filterTree";
import tree from "../layout/StructureTreePanel.module.css";
import styles from "./Strip.module.css";

/**
 * The widest width: the whole editable tree. What the old structure panel did (add,
 * rename, reorder by drag, fold, arrow keys) with a filter box on top; the rows are the
 * same `StructureTreeNode`.
 */
export default function FullTree({ storyId }: { storyId: string | undefined }) {
  const navigate = useNavigate();
  const { structure, setStructure, activeTemplate, activeNode } = useStoryStore();
  const { viewMode, setViewMode } = useUIStore();
  const [filter, setFilter] = useState("");
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
  const collapsed = filter.trim()
    ? new Set<string>()
    : collapsedState.storyId === storyId
      ? collapsedState.ids
      : loadCollapsed(storyId);
  const structureRef = useRef(structure);
  useEffect(() => {
    structureRef.current = structure;
  });
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleCollapsed(id: string) {
    const next = new Set(collapsedState.storyId === storyId ? collapsedState.ids : loadCollapsed(storyId));
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

  function handleKeyNav(e: React.KeyboardEvent, id: string) {
    const ids = visibleIds(structureRef.current, collapsed);
    const idx = ids.indexOf(id);
    const focus = (targetId: string | undefined) => {
      if (targetId) document.querySelector<HTMLElement>(`[data-tree-node="${targetId}"]`)?.focus();
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
    if (addingLevel === 0 || activeTemplate?.flat) {
      const node = await api.createNode(storyId, {
        title: newTitle.trim(),
        level: 0,
        level_type: levelDef.name.toLowerCase(),
        position: structure.length,
      });
      setStructure([...structure, { ...node, children: [] }]);
    } else {
      const parent = parentForLevel(structure, addingLevel, activeNode);
      if (!parent) return;
      const node = await api.createNode(storyId, {
        title: newTitle.trim(),
        parent_id: parent.id,
        level: addingLevel,
        level_type: levelDef.name.toLowerCase(),
        position: parent.children?.length ?? 0,
      });
      setStructure(insertNodeIntoTree(structure, parent.id, { ...node, children: [] }));
      // A new scene is somewhere to write: open it.
      if (addingLevel === (activeTemplate?.levels.length ?? 0) - 1)
        navigate(`/stories/${storyId}/write/${node.id}`);
    }
    setNewTitle("");
    setAddingLevel(null);
  }

  function handleDrop(draggedId: string, targetId: string, zone: "above" | "below" | "into") {
    const prev = structureRef.current;
    const next = reorderInTree(prev, draggedId, targetId, zone);
    if (next === prev) return;
    setStructure(next);
    api.reorderStructure(storyId!, flattenPositions(next)).catch(() => setStructure(prev));
  }

  const shown = filterTree(structure, filter);

  return (
    <div>
      <div className={tree.header} style={{ padding: "0.35rem 0.5rem" }}>
        <label className={tree.viewPicker} style={{ margin: 0, flex: 1 }}>
          <span className={tree.viewPickerLabel}>View</span>
          <select
            className={tree.viewSelect}
            value={viewMode}
            onChange={(e) => {
              const v = e.target.value as typeof viewMode;
              setViewMode(v);
              if (v !== "tree") navigate(`/stories/${storyId}/write`);
              else if (activeNode) navigate(`/stories/${storyId}/write/${activeNode.id}`);
            }}
          >
            <option value="tree">Write</option>
            <option value="storyboard">Storyboard</option>
            <option value="summary">Summaries</option>
            <option value="manuscript">Manuscript &amp; export</option>
            <option value="todos">TODOs</option>
          </select>
        </label>
        <div className={tree.addMenuWrap} ref={addMenuRef}>
          <button
            className={`${tree.addBtn} ${showAddMenu ? tree.addBtnActive : ""}`}
            onClick={() => {
              setShowAddMenu((v) => !v);
              setAddingLevel(null);
              setNewTitle("");
            }}
            title="Add to the outline"
            aria-label="Add to the outline"
          >
            <Plus size={12} />
          </button>
          {showAddMenu && (
            <div className={tree.addMenu}>
              {activeTemplate?.levels.map((level, idx) => {
                const parent = activeTemplate.flat ? null : parentForLevel(structure, idx, activeNode);
                const enabled = idx === 0 || activeTemplate.flat || !!parent;
                const above = activeTemplate.levels[idx - 1]?.name.toLowerCase() ?? "";
                const hint =
                  idx === 0 || activeTemplate.flat
                    ? undefined
                    : parent
                      ? `in ${parent.title}`
                      : `Add ${/^[aeiou]/.test(above) ? "an" : "a"} ${above} first`;
                const Icon = getSegmentIcon(level.name.toLowerCase());
                return (
                  <button
                    key={level.name}
                    className={`${tree.addMenuItem} ${!enabled ? tree.addMenuItemDisabled : ""}`}
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
                    <span className={tree.addMenuLabel}>
                      <span>Add {level.name}</span>
                      {hint && <span className={tree.addMenuHint}>{hint}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className={styles.filterWrap}>
        <input
          className={styles.filter}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter scenes…"
          aria-label="Filter scenes"
        />
      </div>
      <div className={tree.tree}>
        {addingLevel !== null && (
          <div className={tree.addInlineRow}>
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
                  : `${activeTemplate?.levels[addingLevel]?.name ?? "Node"} title (in ${parentForLevel(structure, addingLevel, activeNode)?.title ?? "…"})…`
              }
              className={tree.addInput}
            />
          </div>
        )}
        {structure.length === 0 && addingLevel === null && (
          <p className={tree.emptyHint}>Nothing here yet. Start writing opens a first outline.</p>
        )}
        {shown.length === 0 && structure.length > 0 && <p className={tree.emptyHint}>Nothing matches.</p>}
        {shown.map((node) => (
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
