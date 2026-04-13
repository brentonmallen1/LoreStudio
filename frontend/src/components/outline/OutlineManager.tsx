import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Plus, X, Trash2, Info, Snowflake, BookOpen, Pencil, Sparkles, Compass, CheckSquare } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import { api } from "../../api/client";
import { useHistoryStore } from "../../stores/historyStore";
import type { Outline, OutlineItem, StructureNode } from "../../types";
import OutlineItemComponent from "./OutlineItem";
import SnowflakeView from "./SnowflakeView";
import OutlineInfoModal from "./OutlineInfoModal";
import ExtractOutlinePanel from "./ExtractOutlinePanel";
import OutlineAlignmentPanel from "./OutlineAlignmentPanel";
import styles from "./OutlineManager.module.css";

// ── Tree helpers ───────────────────────────────────────────────────────────────

function reorderInTree(
  nodes: OutlineItem[],
  draggedId: string,
  targetId: string,
  zone: "above" | "below" | "into"
): OutlineItem[] {
  let dragged: OutlineItem | null = null;

  function extract(list: OutlineItem[]): OutlineItem[] {
    return list.flatMap((n) => {
      if (n.id === draggedId) { dragged = n; return []; }
      return [{ ...n, children: extract(n.children ?? []) }];
    });
  }

  function insert(list: OutlineItem[]): OutlineItem[] {
    if (zone === "into") {
      return list.map((n) => {
        if (n.id === targetId) return { ...n, children: [...(n.children ?? []), dragged!] };
        return { ...n, children: insert(n.children ?? []) };
      });
    }
    const idx = list.findIndex((n) => n.id === targetId);
    if (idx !== -1) {
      const copy = [...list];
      copy.splice(zone === "above" ? idx : idx + 1, 0, dragged!);
      return copy;
    }
    return list.map((n) => ({ ...n, children: insert(n.children ?? []) }));
  }

  const withoutDragged = extract(nodes);
  if (!dragged) return nodes;
  return insert(withoutDragged);
}

function flattenPositions(
  nodes: OutlineItem[],
  parentId: string | null = null
): { item_id: string; parent_id: string | null; position: number }[] {
  const ops: { item_id: string; parent_id: string | null; position: number }[] = [];
  nodes.forEach((n, i) => {
    ops.push({ item_id: n.id, parent_id: parentId, position: i });
    ops.push(...flattenPositions(n.children ?? [], n.id));
  });
  return ops;
}

function updateItemInTree(
  nodes: OutlineItem[],
  id: string,
  patch: Partial<OutlineItem>
): OutlineItem[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch };
    return { ...n, children: updateItemInTree(n.children ?? [], id, patch) };
  });
}

function removeItemFromTree(nodes: OutlineItem[], id: string): OutlineItem[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeItemFromTree(n.children ?? [], id) }));
}

function findContext(
  nodes: OutlineItem[],
  id: string,
  parentId: string | null = null
): { parentId: string | null; prevSiblingId: string | null } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return { parentId, prevSiblingId: i > 0 ? nodes[i - 1].id : null };
    }
    const result = findContext(nodes[i].children ?? [], id, nodes[i].id);
    if (result) return result;
  }
  return null;
}

function insertChildInTree(
  nodes: OutlineItem[],
  parentId: string,
  child: OutlineItem
): OutlineItem[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children ?? []), child] };
    return { ...n, children: insertChildInTree(n.children ?? [], parentId, child) };
  });
}

const BEAT_TYPES = ["plot", "character", "theme", "setting"] as const;

// ── Outline list panel ─────────────────────────────────────────────────────────

interface OutlinePanelProps {
  outline: Outline;
  storyId: string;
}

function flattenIds(nodes: OutlineItem[]): string[] {
  return nodes.flatMap((n) => [n.id, ...flattenIds(n.children ?? [])]);
}

function OutlinePanel({ outline, storyId }: OutlinePanelProps) {
  const navigate = useNavigate();
  const { structure, setActiveNode } = useStoryStore();
  const [showAlignment, setShowAlignment] = useState(false);
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionActive, setSelectionActive] = useState(false);
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootText, setNewRootText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sceneNodes, setSceneNodes] = useState<StructureNode[]>([]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pushHistory = useHistoryStore((s) => s.push);
  const pendingUpdates = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setLoading(true);
    api.getOutlineWithItems(outline.id)
      .then((data) => setItems(data.items))
      .finally(() => setLoading(false));
  }, [outline.id]);

  useEffect(() => {
    api.getStructure(storyId).then((tree) => {
      const leaves: StructureNode[] = [];
      function walk(nodes: StructureNode[]) {
        for (const n of nodes) {
          if (!n.children?.length) leaves.push(n);
          else walk(n.children);
        }
      }
      walk(tree);
      setSceneNodes(leaves);
    }).catch(() => {});
  }, [storyId]);

  // ── DnD ─────────────────────────────────────────────────────────────────────

  function handleDrop(draggedId: string, targetId: string, zone: "above" | "below" | "into") {
    const prev = itemsRef.current;
    const next = reorderInTree(prev, draggedId, targetId, zone);
    if (next === prev) return;
    pushHistory({
      description: "Reorder outline",
      undo: () => { setItems(prev); api.bulkReorderOutline(outline.id, flattenPositions(prev)); },
      redo: () => { setItems(next); api.bulkReorderOutline(outline.id, flattenPositions(next)); },
    });
    setItems(next);
    api.bulkReorderOutline(outline.id, flattenPositions(next)).catch(() => setItems(prev));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  function handleUpdate(
    id: string,
    patch: Partial<Pick<OutlineItem, "text" | "notes" | "beat_type" | "collapsed" | "scene_id" | "scene_title">>
  ) {
    setItems((prev) => updateItemInTree(prev, id, patch));
    if ("text" in patch || "notes" in patch) {
      if (pendingUpdates.current[id]) clearTimeout(pendingUpdates.current[id]);
      pendingUpdates.current[id] = setTimeout(() => {
        api.updateOutlineItem(id, patch);
        delete pendingUpdates.current[id];
      }, 500);
    } else {
      api.updateOutlineItem(id, patch);
    }
  }

  function handleDelete(id: string) {
    const prev = itemsRef.current;
    setItems(removeItemFromTree(prev, id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    api.deleteOutlineItem(id).catch(() => setItems(prev));
  }

  async function handleAddRoot(text: string) {
    if (!text.trim()) return;
    const item = await api.createOutlineItem(outline.id, { text: text.trim(), position: 0 });
    const withChildren = { ...item, children: [] };
    setItems((prev) => {
      const next = [...prev, withChildren];
      api.bulkReorderOutline(outline.id, flattenPositions(next));
      return next;
    });
    setFocusId(item.id);
  }

  async function handleAddSibling(afterId: string) {
    function findSiblingContext(
      nodes: OutlineItem[],
      id: string,
      parentId: string | null
    ): { parentId: string | null; idx: number } | null {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) return { parentId, idx: i };
        const found = findSiblingContext(nodes[i].children ?? [], id, nodes[i].id);
        if (found) return found;
      }
      return null;
    }

    const ctx = findSiblingContext(itemsRef.current, afterId, null);
    if (!ctx) return;

    const newItem = await api.createOutlineItem(outline.id, {
      text: "",
      parent_id: ctx.parentId ?? undefined,
      position: ctx.idx + 1,
    });
    const withChildren = { ...newItem, children: [] };

    function insertAfter(nodes: OutlineItem[]): OutlineItem[] {
      const idx = nodes.findIndex((n) => n.id === afterId);
      if (idx !== -1) {
        const copy = [...nodes];
        copy.splice(idx + 1, 0, withChildren);
        return copy;
      }
      return nodes.map((n) => ({ ...n, children: insertAfter(n.children ?? []) }));
    }

    setItems((prev) => {
      const next = insertAfter(prev);
      api.bulkReorderOutline(outline.id, flattenPositions(next));
      return next;
    });
    setFocusId(newItem.id);
  }

  async function handleAddChild(parentId: string) {
    const newItem = await api.createOutlineItem(outline.id, {
      text: "",
      parent_id: parentId,
      position: 0,
    });
    const withChildren = { ...newItem, children: [] };
    setItems((prev) => {
      const next = insertChildInTree(prev, parentId, withChildren);
      api.bulkReorderOutline(outline.id, flattenPositions(next));
      return next;
    });
    setFocusId(newItem.id);
  }

  function handleIndent(id: string) {
    const ctx = findContext(itemsRef.current, id);
    if (!ctx?.prevSiblingId) return;
    const prev = itemsRef.current;
    const next = reorderInTree(prev, id, ctx.prevSiblingId, "into");
    if (next === prev) return;
    pushHistory({
      description: "Indent outline item",
      undo: () => { setItems(prev); api.bulkReorderOutline(outline.id, flattenPositions(prev)); },
      redo: () => { setItems(next); api.bulkReorderOutline(outline.id, flattenPositions(next)); },
    });
    setItems(next);
    api.bulkReorderOutline(outline.id, flattenPositions(next)).catch(() => setItems(prev));
  }

  function handleDedent(id: string) {
    const ctx = findContext(itemsRef.current, id);
    if (!ctx?.parentId) return;
    const prev = itemsRef.current;
    const next = reorderInTree(prev, id, ctx.parentId, "below");
    if (next === prev) return;
    pushHistory({
      description: "Dedent outline item",
      undo: () => { setItems(prev); api.bulkReorderOutline(outline.id, flattenPositions(prev)); },
      redo: () => { setItems(next); api.bulkReorderOutline(outline.id, flattenPositions(next)); },
    });
    setItems(next);
    api.bulkReorderOutline(outline.id, flattenPositions(next)).catch(() => setItems(prev));
  }

  function navigateToScene(sceneId: string) {
    function findNode(nodes: typeof structure): typeof structure[0] | null {
      for (const n of nodes) {
        if (n.id === sceneId) return n;
        if (n.children) { const found = findNode(n.children); if (found) return found; }
      }
      return null;
    }
    const node = findNode(structure);
    if (node) setActiveNode(node);
    navigate(`/stories/${storyId}/write`);
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    const allIds = flattenIds(itemsRef.current);
    setSelected((s) => s.size === allIds.length ? new Set() : new Set(allIds));
  }

  function exitSelectionMode() {
    setSelectionActive(false);
    setSelected(new Set());
  }

  function bulkSetBeatType(type: OutlineItem["beat_type"]) {
    Array.from(selected).forEach((id) => handleUpdate(id, { beat_type: type }));
  }

  function bulkDelete() {
    const ids = Array.from(selected);
    const prev = itemsRef.current;
    let next = prev;
    ids.forEach((id) => { next = removeItemFromTree(next, id); });
    setItems(next);
    exitSelectionMode();
    Promise.all(ids.map((id) => api.deleteOutlineItem(id))).catch(() => {
      setItems(prev);
      setSelected(new Set(ids));
    });
  }

  if (loading) return <div className={styles.loading}>Loading…</div>;

  return (
    <>
      {selectionActive && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selected.size > 0 ? `${selected.size} selected` : "Select items"}
          </span>
          <button className={styles.bulkActionBtn} onClick={toggleSelectAll}>
            {selected.size === flattenIds(itemsRef.current).length ? "Deselect all" : "Select all"}
          </button>
          <span className={styles.bulkSep} />
          {selected.size > 0 && (
            <>
              <span className={styles.bulkLabel}>Type:</span>
              {BEAT_TYPES.map((type) => (
                <button
                  key={type}
                  className={`${styles.bulkDot} ${(styles as Record<string, string>)[`dot_${type}`] ?? ""}`}
                  onClick={() => bulkSetBeatType(type)}
                  title={type}
                />
              ))}
              <button
                className={`${styles.bulkDot} ${styles.dot_none}`}
                onClick={() => bulkSetBeatType(null)}
                title="Clear type"
              />
              <span className={styles.bulkSep} />
              <button
                className={`${styles.bulkActionBtn} ${styles.bulkDanger}`}
                onClick={bulkDelete}
              >
                <Trash2 size={12} />
                Delete
              </button>
            </>
          )}
          <button className={styles.bulkCloseBtn} onClick={exitSelectionMode}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className={styles.managerInner}>
        <div className={styles.header}>
          <h2 className={styles.title}>{outline.name}</h2>
          <div className={styles.headerRight}>
            <button
              className={`${styles.selectBtn} ${selectionActive ? styles.selectBtnActive : ""}`}
              onClick={() => selectionActive ? exitSelectionMode() : setSelectionActive(true)}
              title={selectionActive ? "Exit selection mode" : "Select items"}
            >
              <CheckSquare size={13} />
              {selectionActive ? "Done" : "Select"}
            </button>
            <button
              className={styles.alignmentBtn}
              onClick={() => setShowAlignment((v) => !v)}
              title="Analyze alignment against manuscript"
            >
              <Compass size={13} />
              Alignment
            </button>
            <button
              className={styles.addBeatBtnPrimary}
              onClick={() => { setAddingRoot(true); setNewRootText(""); }}
            >
              <Plus size={14} />
              Add beat
            </button>
          </div>
        </div>

        {showAlignment && (
          <OutlineAlignmentPanel
            outlineId={outline.id}
            onClose={() => setShowAlignment(false)}
          />
        )}

        {addingRoot && (
          <div className={styles.newRootForm}>
            <input
              autoFocus
              className={styles.newRootInput}
              value={newRootText}
              onChange={(e) => setNewRootText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddRoot(newRootText);
                  setNewRootText("");
                  setAddingRoot(false);
                }
                if (e.key === "Escape") { setAddingRoot(false); setNewRootText(""); }
              }}
              onBlur={() => { if (!newRootText.trim()) setAddingRoot(false); }}
              placeholder="Beat text…"
            />
          </div>
        )}

        {items.length === 0 && !addingRoot && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><BookOpen size={36} /></div>
            <p className={styles.emptyTitle}>No beats yet</p>
            <p className={styles.emptyDesc}>
              Add beats to build your outline. Drag to reorder, drag to center to nest.
            </p>
            <button
              className={styles.addBeatBtnPrimary}
              onClick={() => { setAddingRoot(true); setNewRootText(""); }}
            >
              <Plus size={14} />
              Add first beat
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className={styles.tree}>
            {items.map((item) => (
              <OutlineItemComponent
                key={item.id}
                item={item}
                depth={0}
                selected={selected}
                selectionActive={selectionActive}
                onToggleSelect={toggleSelect}
                onDrop={handleDrop}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAddSibling={handleAddSibling}
                onAddChild={handleAddChild}
                onIndent={handleIndent}
                onDedent={handleDedent}
                focusId={focusId}
                sceneNodes={sceneNodes}
                onNavigateToScene={navigateToScene}
              />
            ))}
            <button className={styles.addRootRow} onClick={() => { setAddingRoot(true); setNewRootText(""); }}>
              <Plus size={13} />
              Add beat
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Tab rename input ───────────────────────────────────────────────────────────

interface TabRenameProps {
  initialValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function TabRenameInput({ initialValue, onCommit, onCancel }: TabRenameProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <input
      autoFocus
      className={styles.tabRenameInput}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.stopPropagation(); onCommit(value.trim() || initialValue); }
        if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
      }}
      onBlur={() => onCommit(value.trim() || initialValue)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Main OutlineManager ────────────────────────────────────────────────────────

interface Props {
  storyId: string;
}

export default function OutlineManager({ storyId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [outlines, setOutlines] = useState<Outline[]>([]);
  const [activeTab, setActiveTab] = useState<"snowflake" | string>("snowflake");
  const [loadingOutlines, setLoadingOutlines] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showExtractPanel, setShowExtractPanel] = useState(false);

  useEffect(() => {
    api.listOutlines(storyId)
      .then((data) => {
        setOutlines(data);
        // If navigated here with ?tab=<id>, switch to that tab
        const tabParam = searchParams.get("tab");
        if (tabParam && data.some((o) => o.id === tabParam)) {
          setActiveTab(tabParam);
          setSearchParams({}, { replace: true });
        }
      })
      .finally(() => setLoadingOutlines(false));
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateOutline() {
    const outline = await api.createOutline(storyId, "Outline");
    setOutlines((prev) => [...prev, outline]);
    setActiveTab(outline.id);
  }

  async function handleDeleteOutline(id: string) {
    if (!confirm("Delete this outline and all its beats?")) return;
    await api.deleteOutline(id);
    setOutlines((prev) => prev.filter((o) => o.id !== id));
    if (activeTab === id) setActiveTab("snowflake");
  }

  async function handleRenameCommit(id: string, name: string) {
    setRenamingId(null);
    setOutlines((prev) => prev.map((o) => o.id === id ? { ...o, name } : o));
    api.updateOutline(id, { name });
  }

  const activeOutline = outlines.find((o) => o.id === activeTab) ?? null;

  return (
    <div className={styles.manager}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {/* Snowflake tab — always first */}
          <button
            className={`${styles.tab} ${activeTab === "snowflake" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("snowflake")}
          >
            <Snowflake size={12} />
            Snowflake
          </button>

          {/* Outline tabs */}
          {outlines.map((outline) => (
            <div
              key={outline.id}
              className={`${styles.tab} ${activeTab === outline.id ? styles.tabActive : ""}`}
              onClick={() => { if (renamingId !== outline.id) setActiveTab(outline.id); }}
            >
              {renamingId === outline.id ? (
                <TabRenameInput
                  initialValue={outline.name}
                  onCommit={(name) => handleRenameCommit(outline.id, name)}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <>
                  <span
                    className={styles.tabName}
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(outline.id); }}
                  >
                    {outline.name}
                  </span>
                  <button
                    className={styles.tabRenameBtn}
                    onClick={(e) => { e.stopPropagation(); setRenamingId(outline.id); }}
                    title="Rename"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    className={styles.tabCloseBtn}
                    onClick={(e) => { e.stopPropagation(); handleDeleteOutline(outline.id); }}
                    title="Delete outline"
                  >
                    <X size={11} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add outline button */}
          <button
            className={styles.addTabBtn}
            onClick={handleCreateOutline}
            title="New blank outline"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className={styles.tabBarActions}>
          {/* Extract from prose */}
          <button
            className={styles.extractBtn}
            onClick={() => setShowExtractPanel(true)}
            title="AI: Extract outline from manuscript prose"
          >
            <Sparkles size={13} />
            Extract
          </button>

          {/* Info button */}
          <button
            className={styles.infoBtn}
            onClick={() => setShowInfoModal(true)}
            title="About Snowflake & outlines"
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* Tab content */}
      {loadingOutlines ? (
        <div className={styles.loading}>Loading…</div>
      ) : activeTab === "snowflake" ? (
        <div className={styles.manager}>
          <div className={styles.managerInner}>
            <div className={styles.header}>
              <h2 className={styles.title}>Snowflake Method</h2>
            </div>
            <SnowflakeView
              storyId={storyId}
              onSwitchToList={() => {
                if (outlines.length > 0) setActiveTab(outlines[0].id);
                else handleCreateOutline();
              }}
            />
          </div>
        </div>
      ) : activeOutline ? (
        <OutlinePanel
          key={activeOutline.id}
          outline={activeOutline}
          storyId={storyId}
        />
      ) : (
        <div className={styles.managerInner}>
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><BookOpen size={36} /></div>
            <p className={styles.emptyTitle}>No outlines yet</p>
            <p className={styles.emptyDesc}>
              Create a blank outline or inject a beat sheet template from the Lorebook.
            </p>
            <button className={styles.addBeatBtnPrimary} onClick={handleCreateOutline}>
              <Plus size={14} />
              New outline
            </button>
          </div>
        </div>
      )}

      {showInfoModal && <OutlineInfoModal onClose={() => setShowInfoModal(false)} />}

      {showExtractPanel && (
        <ExtractOutlinePanel
          storyId={storyId}
          onClose={() => setShowExtractPanel(false)}
          onCreated={(outlineId) => {
            api.listOutlines(storyId).then((data) => {
              setOutlines(data);
              setActiveTab(outlineId);
            });
          }}
        />
      )}
    </div>
  );
}
