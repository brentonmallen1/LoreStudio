import { useState, useEffect, useRef } from "react";
import { Plus, X, Trash2, BookOpen, Snowflake } from "lucide-react";
import { api } from "../../api/client";
import { useHistoryStore } from "../../stores/historyStore";
import type { OutlineItem } from "../../types";
import OutlineItemComponent from "./OutlineItem";
import SnowflakeView from "./SnowflakeView";
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

// ── Constants ──────────────────────────────────────────────────────────────────

const BEAT_TYPES = ["plot", "character", "theme", "setting"] as const;

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  storyId: string;
}

export default function OutlineManager({ storyId }: Props) {
  const [mode, setMode] = useState<"list" | "snowflake">("list");
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingRoot, setAddingRoot] = useState(false);
  const [newRootText, setNewRootText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  // Stale-closure-safe ref (same pattern as StructureTreePanel)
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pushHistory = useHistoryStore((s) => s.push);

  // Pending debounced API update timers
  const pendingUpdates = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    api.getOutline(storyId)
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, [storyId]);

  // ── DnD ───────────────────────────────────────────────────────────────────

  function handleDrop(draggedId: string, targetId: string, zone: "above" | "below" | "into") {
    const prev = itemsRef.current;
    const next = reorderInTree(prev, draggedId, targetId, zone);
    if (next === prev) return;
    pushHistory({
      description: "Reorder outline",
      undo: () => { setItems(prev); api.bulkReorderOutline(storyId, flattenPositions(prev)); },
      redo: () => { setItems(next); api.bulkReorderOutline(storyId, flattenPositions(next)); },
    });
    setItems(next);
    api.bulkReorderOutline(storyId, flattenPositions(next)).catch(() => setItems(prev));
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function handleUpdate(
    id: string,
    patch: Partial<Pick<OutlineItem, "text" | "notes" | "beat_type" | "collapsed">>
  ) {
    setItems((prev) => updateItemInTree(prev, id, patch));

    if ("text" in patch || "notes" in patch) {
      // Debounce text/notes API calls
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
    const item = await api.createOutlineItem(storyId, { text: text.trim(), position: 0 });
    const withChildren = { ...item, children: [] };
    setItems((prev) => {
      const next = [...prev, withChildren];
      api.bulkReorderOutline(storyId, flattenPositions(next));
      return next;
    });
    setFocusId(item.id);
  }

  async function handleAddSibling(afterId: string) {
    // Find parent + index of afterId in its sibling list
    function findContext(
      nodes: OutlineItem[],
      id: string,
      parentId: string | null
    ): { parentId: string | null; idx: number } | null {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) return { parentId, idx: i };
        const found = findContext(nodes[i].children ?? [], id, nodes[i].id);
        if (found) return found;
      }
      return null;
    }

    const ctx = findContext(itemsRef.current, afterId, null);
    if (!ctx) return;

    const newItem = await api.createOutlineItem(storyId, {
      text: "",
      parent_id: ctx.parentId ?? undefined,
      position: ctx.idx + 1,
    });
    const withChildren = { ...newItem, children: [] };

    // Insert after the sibling in local state
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
      api.bulkReorderOutline(storyId, flattenPositions(next));
      return next;
    });
    setFocusId(newItem.id);
  }

  async function handleAddChild(parentId: string) {
    const newItem = await api.createOutlineItem(storyId, {
      text: "",
      parent_id: parentId,
      position: 0,
    });
    const withChildren = { ...newItem, children: [] };
    setItems((prev) => {
      const next = insertChildInTree(prev, parentId, withChildren);
      api.bulkReorderOutline(storyId, flattenPositions(next));
      return next;
    });
    setFocusId(newItem.id);
  }

  // ── Indent / Dedent ───────────────────────────────────────────────────────

  function handleIndent(id: string) {
    const ctx = findContext(itemsRef.current, id);
    if (!ctx?.prevSiblingId) return;
    const prev = itemsRef.current;
    const next = reorderInTree(prev, id, ctx.prevSiblingId, "into");
    if (next === prev) return;
    pushHistory({
      description: "Indent outline item",
      undo: () => { setItems(prev); api.bulkReorderOutline(storyId, flattenPositions(prev)); },
      redo: () => { setItems(next); api.bulkReorderOutline(storyId, flattenPositions(next)); },
    });
    setItems(next);
    api.bulkReorderOutline(storyId, flattenPositions(next)).catch(() => setItems(prev));
  }

  function handleDedent(id: string) {
    const ctx = findContext(itemsRef.current, id);
    if (!ctx?.parentId) return;
    const prev = itemsRef.current;
    const next = reorderInTree(prev, id, ctx.parentId, "below");
    if (next === prev) return;
    pushHistory({
      description: "Dedent outline item",
      undo: () => { setItems(prev); api.bulkReorderOutline(storyId, flattenPositions(prev)); },
      redo: () => { setItems(next); api.bulkReorderOutline(storyId, flattenPositions(next)); },
    });
    setItems(next);
    api.bulkReorderOutline(storyId, flattenPositions(next)).catch(() => setItems(prev));
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // ── Bulk operations ───────────────────────────────────────────────────────

  function bulkSetBeatType(type: OutlineItem["beat_type"]) {
    Array.from(selected).forEach((id) => handleUpdate(id, { beat_type: type }));
  }

  function bulkDelete() {
    const ids = Array.from(selected);
    const prev = itemsRef.current;
    let next = prev;
    ids.forEach((id) => { next = removeItemFromTree(next, id); });
    setItems(next);
    setSelected(new Set());
    Promise.all(ids.map((id) => api.deleteOutlineItem(id))).catch(() => {
      setItems(prev);
      setSelected(new Set(ids));
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.loading}>Loading outline…</div>;

  if (mode === "snowflake") {
    return (
      <div className={styles.manager}>
        <div className={styles.managerInner}>
          <div className={styles.header}>
            <h2 className={styles.title}>Snowflake Method</h2>
            <div className={styles.headerRight}>
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeBtn} ${styles.modeBtnActive}`}
                  disabled
                >
                  <Snowflake size={12} />
                  Snowflake
                </button>
                <button
                  className={styles.modeBtn}
                  onClick={() => setMode("list")}
                >
                  List View
                </button>
              </div>
            </div>
          </div>
          <SnowflakeView storyId={storyId} onSwitchToList={() => setMode("list")} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.manager}>
      {/* Bulk action bar — sticky at top */}
      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selected.size} selected</span>
          <span className={styles.bulkSep} />
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
          <button className={styles.bulkCloseBtn} onClick={() => setSelected(new Set())}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className={styles.managerInner}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Outline</h2>
          <div className={styles.headerRight}>
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${styles.modeBtnActive}`}
                disabled
              >
                List View
              </button>
              <button
                className={styles.modeBtn}
                onClick={() => setMode("snowflake")}
              >
                <Snowflake size={12} />
                Snowflake
              </button>
            </div>
            <button
              className={styles.addBeatBtnPrimary}
              onClick={() => { setAddingRoot(true); setNewRootText(""); }}
            >
              <Plus size={14} />
              Add beat
            </button>
          </div>
        </div>

        {/* New root item inline form */}
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

        {/* Empty state */}
        {items.length === 0 && !addingRoot && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><BookOpen size={36} /></div>
            <p className={styles.emptyTitle}>No outline yet</p>
            <p className={styles.emptyDesc}>
              Add beats to build your story outline. Drag to reorder, drag to center to nest.
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

        {/* Tree */}
        {items.length > 0 && (
          <div className={styles.tree}>
            {items.map((item) => (
              <OutlineItemComponent
                key={item.id}
                item={item}
                depth={0}
                selected={selected}
                hasSelection={selected.size > 0}
                onToggleSelect={toggleSelect}
                onDrop={handleDrop}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAddSibling={handleAddSibling}
                onAddChild={handleAddChild}
                onIndent={handleIndent}
                onDedent={handleDedent}
                focusId={focusId}
              />
            ))}
            <button className={styles.addRootRow} onClick={() => { setAddingRoot(true); setNewRootText(""); }}>
              <Plus size={13} />
              Add beat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
