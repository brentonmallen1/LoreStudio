import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  ArrowLeft,
  BookOpen,
  Maximize2,
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
  type LucideIcon,
} from "lucide-react";

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
import type { StructureNode } from "../../types";
import styles from "./Sidebar.module.css";

function NodeItem({ node, depth = 0, storyId }: { node: StructureNode; depth?: number; storyId?: string }) {
  const [expanded, setExpanded] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const { activeNode, setActiveNode, activeTemplate, structure, setStructure } = useStoryStore();
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeNode?.id === node.id;

  // Determine the child level's type name from the template
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
    // Insert child into structure tree
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
          onClick={() => setActiveNode(node)}
          className={styles.nodeRow}
        >
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

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storyId, characterId } = useParams<{ storyId: string; characterId?: string }>();
  const { activeStory, structure, setStructure, characters, activeTemplate } = useStoryStore();
  const { toggleFocusMode, viewMode, setViewMode } = useUIStore();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Derive active tab from URL — fixes visual update bug
  const tab = (() => {
    const path = location.pathname;
    if (path.includes("/characters")) return "characters";
    if (path.includes("/bible")) return "bible";
    if (path.includes("/panels")) return "panels";
    if (path.includes("/threads")) return "threads";
    return "story";
  })();

  // Top-level type from template (e.g. "act", "section")
  const topLevelType = activeTemplate?.levels[0]?.name.toLowerCase() ?? "section";
  const topLevelLabel = activeTemplate?.levels[0]?.name ?? "Section";

  async function addTopLevelNode() {
    if (!storyId || !newTitle.trim()) return;
    const node = await api.createNode(storyId, {
      title: newTitle.trim(),
      level: 0,
      level_type: topLevelType,
      position: structure.length,
    });
    setStructure([...structure, { ...node, children: [] }]);
    setNewTitle("");
    setAdding(false);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <button
          onClick={() => navigate("/")}
          className={styles.backBtn}
          title="Back to dashboard"
        >
          <ArrowLeft size={14} />
        </button>
        <span className={styles.storyTitle} title={activeStory?.title}>
          {activeStory?.title ?? "Story"}
        </span>
        <button
          onClick={toggleFocusMode}
          className={styles.focusBtn}
          title="Focus mode"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div className={styles.tabs}>
        {(["story", "characters", "bible", "panels", "threads"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === "characters") navigate(`/stories/${storyId}/characters`);
              else if (t === "bible") navigate(`/stories/${storyId}/bible`);
              else if (t === "panels") navigate(`/stories/${storyId}/panels`);
              else if (t === "threads") navigate(`/stories/${storyId}/threads`);
              else navigate(`/stories/${storyId}`);
            }}
            className={`${styles.tab} ${tab === t ? styles.activeTab : ""}`}
            title={t === "story" ? "Structure" : t === "characters" ? "Characters" : t === "bible" ? "Bible" : t === "panels" ? "Group Interviews" : "Plot Threads"}
          >
            {t === "story" ? <BookOpen size={12} /> : t === "characters" ? <Users size={12} /> : t === "bible" ? <Scroll size={12} /> : t === "panels" ? <MessageSquareMore size={12} /> : <GitBranch size={12} />}
          </button>
        ))}
      </div>

      {tab === "story" && (
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
        </div>
      )}

      <div className={styles.tree}>
        {tab === "story" && (
          <>
            {structure.length === 0 && (
              <p className={styles.emptyHint}>No sections yet</p>
            )}
            {structure.map((node) => (
              <NodeItem key={node.id} node={node} storyId={storyId} />
            ))}
          </>
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

      {tab === "story" && (
        <div className={styles.addSection}>
          {adding ? (
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTopLevelNode();
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={() => {
                if (!newTitle.trim()) setAdding(false);
              }}
              placeholder="Section title…"
              className={styles.addInput}
            />
          ) : (
            <button onClick={() => setAdding(true)} className={styles.addBtn}>
              <Plus size={12} />
              Add {topLevelLabel}
            </button>
          )}
        </div>
      )}

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
    </aside>
  );
}
