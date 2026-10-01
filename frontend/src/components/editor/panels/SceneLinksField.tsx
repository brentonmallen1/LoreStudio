import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { api } from "../../../api/client";
import type { SceneLink, Story, StructureNode } from "../../../types";
import { LINK_TYPES } from "../segmentMeta";
import styles from "../SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  activeStory: Story;
  flatNodes: StructureNode[];
  onNavigate: (node: StructureNode) => void;
}

function linkLabel(link: SceneLink, isForward: boolean): string {
  const t = LINK_TYPES.find((lt) => lt.value === link.link_type);
  if (!t) return isForward ? `${link.link_type} →` : `← ${link.link_type}`;
  return isForward ? t.forward : t.reverse;
}

/** Typed links between this scene and others (foreshadows, calls back, ...). */
export default function SceneLinksField({ activeNode, activeStory, flatNodes, onNavigate }: Props) {
  const [links, setLinks] = useState<SceneLink[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SceneLink | null>(null);
  const [form, setForm] = useState({
    type: "foreshadowing",
    note: "",
    search: "",
    target: null as StructureNode | null,
  });

  useEffect(() => {
    api
      .getSceneLinks({ node_id: activeNode.id })
      .then(setLinks)
      .catch(() => {});
  }, [activeNode.id]);

  const findNode = (id: string) => flatNodes.find((n) => n.id === id);

  function resetForm() {
    setForm({ type: "foreshadowing", note: "", search: "", target: null });
  }

  async function create() {
    if (!form.target) return;
    try {
      const link = await api.createSceneLink({
        story_id: activeStory.id,
        source_node_id: activeNode.id,
        target_node_id: form.target.id,
        link_type: form.type,
        note: form.note,
      });
      setLinks((prev) => [...prev, link]);
    } catch {
      /* silently ignore */
    }
    setAdding(false);
    resetForm();
  }

  async function update() {
    if (!editing) return;
    try {
      const updated = await api.updateSceneLink(editing.id, { link_type: form.type, note: form.note });
      setLinks((prev) => prev.map((l) => (l.id === editing.id ? updated : l)));
    } catch {
      /* silently ignore */
    }
    setEditing(null);
  }

  async function remove(linkId: string) {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    try {
      await api.deleteSceneLink(linkId);
    } catch {
      /* optimistic removal stands */
    }
  }

  const typeSelect = (
    <div className={styles.modalField}>
      <label className={styles.modalLabel}>Link type</label>
      <select
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        className={styles.modalSelect}
      >
        {LINK_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.forward}
          </option>
        ))}
      </select>
    </div>
  );
  const noteField = (autoFocus = false) => (
    <div className={styles.modalField}>
      <label className={styles.modalLabel}>Note (optional)</label>
      <textarea
        value={form.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        placeholder="Describe how these scenes connect…"
        className={styles.modalTextarea}
        rows={2}
        autoFocus={autoFocus}
      />
    </div>
  );

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>Linked Scenes</label>
        <button
          className={styles.addLinkBtn}
          onClick={() => {
            resetForm();
            setAdding(true);
          }}
        >
          <Plus size={11} />
          Add Link
        </button>
      </div>
      {links.length === 0 ? (
        <p className={styles.overviewHint}>No scene links yet.</p>
      ) : (
        <div className={styles.linkChips}>
          {links.map((link) => {
            const isForward = link.source_node_id === activeNode.id;
            const linkedNode = findNode(isForward ? link.target_node_id : link.source_node_id);
            return (
              <div key={link.id} className={styles.linkChip}>
                <button
                  className={styles.linkChipContent}
                  onClick={() => linkedNode && onNavigate(linkedNode)}
                  title={link.note || undefined}
                >
                  <span className={styles.linkChipLabel}>{linkLabel(link, isForward)}</span>
                  <span className={styles.linkChipTitle}>{linkedNode?.title ?? "Unknown scene"}</span>
                </button>
                <button
                  className={styles.linkChipEdit}
                  onClick={() => {
                    setForm({ type: link.link_type, note: link.note ?? "", search: "", target: null });
                    setEditing(link);
                  }}
                  title="Edit link"
                >
                  <Pencil size={10} />
                </button>
                <button className={styles.linkChipDelete} onClick={() => remove(link.id)} title="Remove link">
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className={styles.modalOverlay} onClick={() => setAdding(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Add Scene Link</span>
              <button className={styles.modalClose} onClick={() => setAdding(false)}>
                <X size={14} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Target scene</label>
                <input
                  type="text"
                  placeholder="Search scenes…"
                  value={form.search}
                  onChange={(e) => setForm((f) => ({ ...f, search: e.target.value }))}
                  className={styles.modalInput}
                  autoFocus
                />
                <div className={styles.nodeList}>
                  {flatNodes
                    .filter(
                      (n) =>
                        n.id !== activeNode.id && n.title.toLowerCase().includes(form.search.toLowerCase()),
                    )
                    .map((n) => (
                      <button
                        key={n.id}
                        className={`${styles.nodeListItem} ${form.target?.id === n.id ? styles.nodeListItemSelected : ""}`}
                        onClick={() => setForm((f) => ({ ...f, target: n }))}
                      >
                        <span className={styles.nodeListType}>{n.level_type}</span>
                        {n.title}
                      </button>
                    ))}
                </div>
              </div>
              {typeSelect}
              {noteField()}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button className={styles.modalSave} onClick={create} disabled={!form.target}>
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Edit Scene Link</span>
              <button className={styles.modalClose} onClick={() => setEditing(null)}>
                <X size={14} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {typeSelect}
              {noteField(true)}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className={styles.modalSave} onClick={update}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
