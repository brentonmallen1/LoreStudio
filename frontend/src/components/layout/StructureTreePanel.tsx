import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  PanelLeftOpen,
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

function NodeItem({ node, depth = 0, storyId }: { node: StructureNode; depth?: number; storyId?: string }) {
  const [expanded, setExpanded] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
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

  return (
    <div>
      <div
        className={`${styles.nodeRowWrap} ${isActive ? styles.nodeRowWrapActive : ""}`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
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
            const Icon = getSegmentIcon(node.level_type);
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
            <NodeItem key={child.id} node={child} depth={depth + 1} storyId={storyId} />
          ))}
        </div>
      )}
    </div>
  );
}

interface StructureTreePanelProps {
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
  overlay?: boolean;
}

export default function StructureTreePanel({ onMouseLeave, onMouseEnter, overlay }: StructureTreePanelProps) {
  const { storyId } = useParams<{ storyId: string }>();
  const { structure, setStructure, activeTemplate, activeNode } = useStoryStore();
  const { treePanelWidth, setTreePanelWidth, setTreeDetached } = useUIStore();

  const [addingLevel, setAddingLevel] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

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

  // Horizontal resize (drag left edge to change width)
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
      {/* Resize handle on right edge */}
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
          <NodeItem key={node.id} node={node} storyId={storyId} />
        ))}
      </div>
    </div>
  );
}
