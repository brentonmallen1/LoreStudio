import { useState, useEffect, useCallback } from "react";
import { ListTree, Plus } from "lucide-react";
import { api } from "../../api/client";
import type { OutlineItem as OutlineItemType, OutlineBeatType } from "../../types";
import OutlineItem from "./OutlineItem";
import styles from "./OutlineManager.module.css";

// ── Tree utilities ─────────────────────────────────────────────────────────────

function updateInTree(
  items: OutlineItemType[],
  id: string,
  data: Partial<OutlineItemType>,
): OutlineItemType[] {
  return items.map((item) => {
    if (item.id === id) return { ...item, ...data };
    return { ...item, children: updateInTree(item.children, id, data) };
  });
}

function findInTree(items: OutlineItemType[], id: string): OutlineItemType | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findInTree(item.children, id);
    if (found) return found;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function OutlineManager({ storyId }: { storyId: string }) {
  const [outline, setOutline] = useState<OutlineItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await api.getOutline(storyId);
    setOutline(data);
  }, [storyId]);

  useEffect(() => {
    api
      .getOutline(storyId)
      .then(setOutline)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  async function handleSave(
    id: string,
    text: string,
    beatType: OutlineBeatType | null,
    notes: string,
  ) {
    // Optimistic update
    setOutline((prev) => updateInTree(prev, id, { text, beat_type: beatType, notes }));
    await api.updateOutlineItem(id, { text, beat_type: beatType ?? undefined, notes });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this beat and all its children?")) return;
    await api.deleteOutlineItem(id);
    await reload();
  }

  async function handleAddChild(parentId: string): Promise<string> {
    const item = await api.createOutlineItem(storyId, { text: "", parent_id: parentId });
    await reload();
    return item.id;
  }

  async function handleAddSibling(afterId: string, parentId: string | null): Promise<string> {
    // Find position: after afterId's position
    const parent = parentId ? findInTree(outline, parentId) : null;
    const siblings = parent ? parent.children : outline;
    const afterItem = siblings.find((s) => s.id === afterId);
    const position = afterItem ? afterItem.position + 1 : siblings.length;

    const item = await api.createOutlineItem(storyId, {
      text: "",
      parent_id: parentId,
      position,
    });
    await reload();
    return item.id;
  }

  async function handleAddRoot(): Promise<string> {
    const item = await api.createOutlineItem(storyId, {
      text: "",
      parent_id: null,
      position: outline.length,
    });
    await reload();
    return item.id;
  }

  async function handleIndent(itemId: string) {
    // Find previous sibling to become new parent
    const item = findInTree(outline, itemId);
    if (!item) return;
    const siblings = item.parent_id
      ? (findInTree(outline, item.parent_id)?.children ?? outline)
      : outline;
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx <= 0) return; // no previous sibling to indent under

    const prevSibling = siblings[idx - 1];
    await api.updateOutlineItem(itemId, {
      parent_id: prevSibling.id,
      position: prevSibling.children.length,
    });
    await reload();
  }

  async function handleOutdent(itemId: string) {
    const item = findInTree(outline, itemId);
    if (!item || !item.parent_id) return;

    const parent = findInTree(outline, item.parent_id);
    if (!parent) return;

    // Move item to parent's level, right after parent
    const grandparentId = parent.parent_id ?? null;
    const grandparentChildren = grandparentId
      ? (findInTree(outline, grandparentId)?.children ?? outline)
      : outline;
    const parentIdx = grandparentChildren.findIndex((s) => s.id === parent.id);
    const newPosition = parentIdx + 1;

    await api.updateOutlineItem(itemId, {
      parent_id: grandparentId,
      position: newPosition,
    });
    await reload();
  }

  function handleCollapse(id: string, collapsed: boolean) {
    setOutline((prev) => updateInTree(prev, id, { collapsed }));
    api.updateOutlineItem(id, { collapsed }).catch(() => {});
  }

  async function handleReorder(parentId: string | null, itemIds: string[]) {
    // Optimistic update
    setOutline((prev) => {
      if (!parentId) {
        const byId = Object.fromEntries(prev.map((i) => [i.id, i]));
        return itemIds.map((id, pos) => ({ ...byId[id], position: pos })).filter(Boolean);
      }
      return updateInTree(prev, parentId, {
        children: (() => {
          const parent = findInTree(prev, parentId);
          if (!parent) return [];
          const byId = Object.fromEntries(parent.children.map((c) => [c.id, c]));
          return itemIds.map((id, pos) => ({ ...byId[id], position: pos })).filter(Boolean);
        })(),
      });
    });
    await api.reorderOutline(storyId, parentId, itemIds);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.manager}>
      <div className={styles.managerInner}>
        <div className={styles.header}>
          <span className={styles.title}>Story Outline</span>
          <div className={styles.headerRight}>
            <button
              className="btn btn-sm"
              onClick={async () => {
                const newId = await handleAddRoot();
                setFocusedId(newId);
              }}
            >
              <Plus size={14} />
              Add Beat
            </button>
          </div>
        </div>

        {outline.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <ListTree size={40} />
            </div>
            <div className={styles.emptyTitle}>No outline yet</div>
            <div className={styles.emptyDesc}>
              Add beats to plan your story's structure. Each beat can have sub-beats,
              notes, and a type tag.
            </div>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const newId = await handleAddRoot();
                setFocusedId(newId);
              }}
            >
              <Plus size={14} />
              Add First Beat
            </button>
          </div>
        ) : (
          <div className={styles.tree}>
            {outline.map((item) => (
              <OutlineItem
                key={item.id}
                item={item}
                siblings={outline}
                onSave={handleSave}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
                onAddSibling={handleAddSibling}
                onIndent={handleIndent}
                onOutdent={handleOutdent}
                onCollapse={handleCollapse}
                onReorder={handleReorder}
                focusedId={focusedId}
                setFocusedId={setFocusedId}
              />
            ))}
            <button
              className={styles.addRootRow}
              onClick={async () => {
                const newId = await handleAddRoot();
                setFocusedId(newId);
              }}
            >
              <Plus size={13} />
              Add beat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
