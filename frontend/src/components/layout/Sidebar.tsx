import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  SquareLibrary,
  Scroll,
  MessageSquareMore,
  GitBranch,
  LayoutGrid,
  List,
  Clock,
  UserCircle2,
  Flag,
  BookMarked,
  Clapperboard,
  Layers,
  Zap,
  Puzzle,
  Milestone,
  Images,
  Activity,
  Home,
  PenLine,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  BookOpen,
  Globe,
  Telescope,
  Send,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { useDiscoveryStore } from "../../stores/discoveryStore";

// Map segment types to icons for visual distinction
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
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useLLMStore } from "../../stores/llmStore";
import { TabActivityIndicator } from "./TabActivityIndicator";
import type { StructureNode } from "../../types";
import AIActivityIndicator from "./AIActivityIndicator";
import styles from "./Sidebar.module.css";

function NodeItem({ node, depth = 0, storyId }: { node: StructureNode; depth?: number; storyId?: string }) {
  const [expanded, setExpanded] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const { activeNode, setActiveNode, activeTemplate, structure, setStructure } = useStoryStore();
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
        <button onClick={() => setActiveNode(node)} className={styles.nodeRow}>
          <span
            className={styles.chevron}
            onClick={hasChildren ? (e) => { e.stopPropagation(); setExpanded((x) => !x); } : undefined}
            role={hasChildren ? "button" : undefined}
          >
            {hasChildren ? (
              expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
            ) : null}
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
        <div className={styles.children}>
          {node.children.map((child) => (
            <NodeItem key={child.id} node={child} depth={depth + 1} storyId={storyId} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
}

export default function Sidebar({ collapsed: collapsedProp, onMouseLeave, onMouseEnter }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { storyId, characterId } = useParams<{ storyId: string; characterId?: string }>();
  const { activeStory, structure, setStructure, characters, activeTemplate, activeNode } = useStoryStore();
  const {
    viewMode, setViewMode,
    sidebarCollapsed, setSidebarCollapsed,
    sidebarTabRailHeight, setSidebarTabRailHeight,
    treeDetached, setTreeDetached,
  } = useUIStore();
  const { pendingCount, refreshCount } = useDiscoveryStore();
  const getTabStatus = useLLMStore((s) => s.getTabStatus);
  const markViewed = useLLMStore((s) => s.markViewed);

  const isCollapsed = collapsedProp ?? sidebarCollapsed;

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

  // Tab rail vertical resize
  const isResizingRail = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(sidebarTabRailHeight);

  function startRailResize(e: React.MouseEvent) {
    isResizingRail.current = true;
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = sidebarTabRailHeight;
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizingRail.current) return;
      const dy = e.clientY - resizeStartY.current;
      const newHeight = Math.max(80, Math.min(400, resizeStartHeight.current + dy));
      setSidebarTabRailHeight(newHeight);
    }
    function onMouseUp() { isResizingRail.current = false; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setSidebarTabRailHeight]);

  // Refresh discovery badge count when story changes
  useEffect(() => {
    if (storyId && activeStory?.discovery_enabled) refreshCount(storyId);
  }, [storyId, activeStory?.discovery_enabled]);

  const tab = (() => {
    const path = location.pathname;
    if (path.includes("/characters")) return "characters";
    if (path.includes("/lorebook")) return "lorebook";
    if (path.includes("/compendium")) return "compendium";
    if (path.includes("/panels")) return "panels";
    if (path.includes("/threads")) return "threads";
    if (path.includes("/twists")) return "twists";
    if (path.includes("/media")) return "media";
    if (path.includes("/health")) return "health";
    if (path.includes("/chronicle")) return "chronicle";
    if (path.includes("/publish")) return "publish";
    if (path.includes("/worldbuilding")) return "worldbuilding";
    if (path.includes("/discoveries")) return "discoveries";
    if (path.includes("/write")) return "story";
    return "overview";
  })();

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

  const tabs: { id: string; icon: LucideIcon; label: string; path: string; badge?: number }[] = [
    { id: "overview",      icon: Home,              label: "Overview",         path: "" },
    { id: "story",         icon: PenLine,           label: "Write",            path: "/write" },
    { id: "characters",    icon: Users,             label: "Characters",       path: "/characters" },
    { id: "lorebook",      icon: Scroll,            label: "Lorebook",         path: "/lorebook" },
    { id: "compendium",    icon: BookOpen,          label: "Compendium",       path: "/compendium" },
    { id: "panels",        icon: MessageSquareMore, label: "Group Interviews", path: "/panels" },
    { id: "threads",       icon: GitBranch,         label: "Plot Threads",     path: "/threads" },
    { id: "twists",        icon: Eye,               label: "Twists",           path: "/twists" },
    { id: "worldbuilding", icon: Globe,             label: "World Building",   path: "/worldbuilding" },
    { id: "media",         icon: Images,            label: "Media & Diagrams", path: "/media" },
    { id: "health",        icon: Activity,          label: "Story Health",     path: "/health" },
    ...(activeStory?.discovery_enabled
      ? [{ id: "discoveries", icon: Telescope, label: "Discoveries", path: "/discoveries", badge: pendingCount || undefined }]
      : []),
    { id: "chronicle",     icon: Clock,             label: "Chronicle",        path: "/chronicle" },
    { id: "publish",       icon: Send,              label: "Publish",          path: "/publish" },
  ];

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""} ${collapsedProp !== undefined ? styles.sidebarOverlay : ""}`}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {/* Header — expanded only */}
      {!isCollapsed && (
        <div className={styles.header}>
          <button
            onClick={() => navigate("/")}
            className={styles.backBtn}
            title="Back to dashboard"
          >
            <SquareLibrary size={14} />
          </button>
          <span className={styles.storyTitle} title={activeStory?.title}>
            {activeStory?.title ?? "Story"}
          </span>
        </div>
      )}

      {/* Vertical tab rail */}
      <nav
        className={styles.tabRail}
        style={!isCollapsed ? { height: sidebarTabRailHeight, overflowY: "auto", flexShrink: 0 } : undefined}
      >
        {/* Back button in collapsed state */}
        {isCollapsed && (
          <button
            onClick={() => navigate("/")}
            className={styles.railBtn}
            title="Back to dashboard"
          >
            <SquareLibrary size={16} />
          </button>
        )}

        {tabs.map(({ id, icon: Icon, label, path, badge }) => {
          const activityStatus = getTabStatus(id);
          return (
            <button
              key={id}
              onClick={() => {
                navigate(`/stories/${storyId}${path}`);
                if (isCollapsed && id === "story" && !treeDetached) setTreeDetached(true);
                markViewed(id);
              }}
              className={`${styles.railBtn} ${tab === id ? styles.railBtnActive : ""}`}
              title={isCollapsed ? (badge ? `${label} (${badge})` : label) : undefined}
            >
              <Icon size={16} />
              {!isCollapsed && <span className={styles.railLabel}>{label}</span>}
              {badge ? (
                <span style={{
                  marginLeft: "auto",
                  background: "var(--color-accent)",
                  color: "white",
                  borderRadius: "9px",
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "1px 5px",
                  minWidth: "16px",
                  textAlign: "center",
                  lineHeight: "14px",
                  flexShrink: 0,
                }}>{badge}</span>
              ) : (
                <TabActivityIndicator status={activityStatus} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Resize handle — between tab rail and tree */}
      {!isCollapsed && (
        <div className={styles.railResizeHandle} onMouseDown={startRailResize} />
      )}

      {/* View mode toggle — expanded + write tab only */}
      {!isCollapsed && tab === "story" && (
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === "tree" ? styles.viewActive : ""}`}
            onClick={() => setViewMode("tree")}
            title="Tree view"
          >
            <List size={12} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "corkboard" ? styles.viewActive : ""}`}
            onClick={() => setViewMode("corkboard")}
            title="Corkboard view"
          >
            <LayoutGrid size={12} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "timeline" ? styles.viewActive : ""}`}
            onClick={() => setViewMode("timeline")}
            title="Timeline view"
          >
            <Clock size={12} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "graph" ? styles.viewActive : ""}`}
            onClick={() => setViewMode("graph")}
            title="Scene link graph"
          >
            <GitBranch size={12} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "manuscript" ? styles.viewActive : ""}`}
            onClick={() => setViewMode("manuscript")}
            title="Manuscript view"
          >
            <BookOpen size={12} />
          </button>
        </div>
      )}

      {/* Content tree — expanded only */}
      {!isCollapsed && (
        <>
          {/* Tree section header (story tab only — shows + add menu + detach button) */}
          {tab === "story" && (
            <div className={styles.treeHeader}>
              <span className={styles.treeHeaderLabel}>Structure</span>
              <div className={styles.treeHeaderRight}>
                {!treeDetached && (
                  <div className={styles.addMenuWrap} ref={addMenuRef}>
                    <button
                      className={`${styles.treeAddBtn} ${showAddMenu ? styles.treeAddBtnActive : ""}`}
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
                )}
                <button
                  className={styles.treeHeaderBtn}
                  onClick={() => setTreeDetached(!treeDetached)}
                  title={treeDetached ? "Dock tree back to sidebar" : "Detach tree to side panel"}
                >
                  <PanelRightOpen size={12} />
                </button>
              </div>
            </div>
          )}

          <div className={styles.tree}>
            {tab === "story" && !treeDetached && (
              <>
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
              </>
            )}

            {tab === "story" && treeDetached && (
              <p className={styles.emptyHint}>Structure tree is open in side panel</p>
            )}

            {tab === "characters" && (
              <>
                {characters.length === 0 && (
                  <p className={styles.emptyHint}>No characters yet</p>
                )}
                {characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => navigate(`/stories/${storyId}/characters/${char.id}`)}
                    className={`${styles.nodeRow} ${characterId === char.id ? styles.nodeActive : ""}`}
                  >
                    <span className={styles.charAvatar}>{char.name[0].toUpperCase()}</span>
                    <span className={styles.nodeLabel}>{char.name}</span>
                    <span className={styles.roleBadge}>{char.role}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {tab === "characters" && (
            <div className={styles.addSection}>
              <button
                onClick={() => navigate(`/stories/${storyId}/characters`)}
                className={styles.addBtn}
              >
                <UserCircle2 size={12} />
                All characters
              </button>
            </div>
          )}

          <AIActivityIndicator />
        </>
      )}

      {/* Collapse toggle — always at bottom, only when not in focus (prop) mode */}
      {collapsedProp === undefined && (
        <button
          className={styles.collapseToggle}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      )}
    </aside>
  );
}
