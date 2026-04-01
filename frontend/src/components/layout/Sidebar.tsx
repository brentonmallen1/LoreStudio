import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  ArrowLeft,
  BookOpen,
  Maximize2,
} from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import type { StructureNode } from "../../types";
import styles from "./Sidebar.module.css";

function NodeItem({ node, depth = 0 }: { node: StructureNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const { activeNode, setActiveNode } = useStoryStore();
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeNode?.id === node.id;

  return (
    <div>
      <button
        onClick={() => {
          setActiveNode(node);
          if (hasChildren) setExpanded((e) => !e);
        }}
        className={`${styles.nodeRow} ${isActive ? styles.nodeActive : ""}`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        <span className={styles.chevron}>
          {hasChildren ? (
            expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          ) : null}
        </span>
        <span className={styles.nodeLabel}>{node.title}</span>
        {node.status !== "draft" && (
          <span className={styles.nodeStatus}>
            {node.status === "final" ? "✓" : "~"}
          </span>
        )}
      </button>
      {hasChildren && expanded && (
        <div className={styles.children}>
          {node.children.map((child) => (
            <NodeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  const { activeStory, structure, setStructure } = useStoryStore();
  const { toggleFocusMode } = useUIStore();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [tab, setTab] = useState<"story" | "characters">("story");

  async function addTopLevelNode() {
    if (!storyId || !newTitle.trim()) return;
    const node = await api.createNode(storyId, {
      title: newTitle.trim(),
      level: 0,
      level_type: "section",
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
        {(["story", "characters"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "characters") navigate(`/stories/${storyId}/characters`);
              else navigate(`/stories/${storyId}`);
            }}
            className={`${styles.tab} ${tab === t ? styles.activeTab : ""}`}
          >
            {t === "story" ? <BookOpen size={12} /> : <Users size={12} />}
            {t === "story" ? "Structure" : "Characters"}
          </button>
        ))}
      </div>

      <div className={styles.tree}>
        {tab === "story" && (
          <>
            {structure.length === 0 && (
              <p className={styles.emptyHint}>No sections yet</p>
            )}
            {structure.map((node) => (
              <NodeItem key={node.id} node={node} />
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
              Add section
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
