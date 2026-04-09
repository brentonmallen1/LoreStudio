import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Users, Trash2, Compass } from "lucide-react";
import { api } from "../../api/client";
import type { Culture } from "../../types";
import { SectionCard } from "../common";
import styles from "./WorldBuilding.module.css";
import { useUIStore } from "../../stores/uiStore";

interface Props {
  storyId: string;
}

export default function CultureManager({ storyId }: Props) {
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [selected, setSelected] = useState<Culture | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState("");
  const { openWorldBuildingAIPanel } = useUIStore();
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(() => {
    api.listCultures(storyId).then(setCultures).finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => { load(); }, [load]);

  function scheduleUpdate(field: string, value: unknown) {
    if (!selected) return;
    setSelected((prev) => prev ? { ...prev, [field]: value } : null);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (!selected) return;
      api.updateCulture(selected.id, { [field]: value } as Partial<Culture>).then(() => load());
    }, 700);
  }

  async function createCulture() {
    if (!newName.trim()) return;
    const created = await api.createCulture(storyId, { name: newName.trim() });
    setShowAddModal(false);
    setNewName("");
    load();
    setSelected(created);
  }

  async function deleteCulture() {
    if (!selected) return;
    await api.deleteCulture(selected.id);
    setSelected(null);
    setShowDeleteConfirm(false);
    load();
  }

  if (loading) return <div className={styles.loading}>Loading cultures…</div>;

  return (
    <div className={styles.manager}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Cultures</h3>
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <Plus size={12} /> Add
          </button>
        </div>
        <div className={styles.sidebarList}>
          {cultures.length === 0 ? (
            <div className={styles.emptyList}>No cultures yet</div>
          ) : (
            cultures.map((c) => (
              <div
                key={c.id}
                className={`${styles.listItem} ${selected?.id === c.id ? styles.listItemActive : ""}`}
                onClick={() => setSelected(c)}
              >
                <Users size={12} color="var(--color-text-muted)" />
                <span className={styles.listItemName}>{c.name}</span>
                {c.government_type && <span className={styles.listItemBadge}>{c.government_type}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.detail}>
        {!selected ? (
          <div className={styles.detailEmpty}>
            <Users size={24} color="var(--color-text-subtle)" />
            <span>Select a culture to view details</span>
          </div>
        ) : (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailName}>{selected.name}</h2>
              <div className={styles.detailActions}>
                <button
                  className={styles.aiBtn}
                  title="Generates creative directions for: Naming Patterns, Rituals & Customs, Aesthetics & Materials, and Questions to Consider"
                  onClick={() => openWorldBuildingAIPanel({ feature: "culture-suggest", entityId: selected.id, storyId })}
                >
                  <Compass size={11} />
                  Suggest Cultural Elements
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  title="Delete culture"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className={styles.detailContent}>
              <SectionCard title="Identity" collapsible={false}>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Name</label>
                    <input className={styles.fieldInput} value={selected.name}
                      onChange={(e) => scheduleUpdate("name", e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Government Type</label>
                    <input className={styles.fieldInput}
                      placeholder="e.g. Monarchy, Republic, Theocracy…"
                      value={selected.government_type}
                      onChange={(e) => scheduleUpdate("government_type", e.target.value)} />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Description</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="What is this culture? Where do they live?"
                    value={selected.description}
                    onChange={(e) => scheduleUpdate("description", e.target.value)} />
                </div>
              </SectionCard>

              <SectionCard title="Values & Beliefs">
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Core Values</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="What do these people believe in? What do they hold sacred?"
                    value={selected.values}
                    onChange={(e) => scheduleUpdate("values", e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Religion & Belief</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="Gods, myths, spiritual practices, clergy…"
                    value={selected.religion}
                    onChange={(e) => scheduleUpdate("religion", e.target.value)} />
                </div>
              </SectionCard>

              <SectionCard title="Social Structure">
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Customs & Traditions</label>
                    <textarea className={styles.fieldTextarea}
                      placeholder="Common practices, ceremonies, daily life…"
                      value={selected.customs}
                      onChange={(e) => scheduleUpdate("customs", e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Taboos</label>
                    <textarea className={styles.fieldTextarea}
                      placeholder="What is forbidden? What is shameful?"
                      value={selected.taboos}
                      onChange={(e) => scheduleUpdate("taboos", e.target.value)} />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Social Hierarchy</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="Class structure, status markers, mobility…"
                    value={selected.social_hierarchy}
                    onChange={(e) => scheduleUpdate("social_hierarchy", e.target.value)} />
                </div>
              </SectionCard>

              <SectionCard title="Economy & Naming">
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Economy</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="Trade, resources, wealth distribution…"
                    value={selected.economy}
                    onChange={(e) => scheduleUpdate("economy", e.target.value)} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Naming Conventions</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="Given names, family names, titles, naming patterns…"
                    value={
                      typeof selected.naming_conventions === "object"
                        ? (selected.naming_conventions as Record<string, string>).notes ?? ""
                        : ""
                    }
                    onChange={(e) =>
                      scheduleUpdate("naming_conventions", {
                        ...selected.naming_conventions,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Notes</label>
                  <textarea className={styles.fieldTextarea}
                    placeholder="Anything else…"
                    value={selected.notes}
                    onChange={(e) => scheduleUpdate("notes", e.target.value)} />
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add culture</h3>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Name</label>
              <input className={styles.fieldInput} autoFocus placeholder="Culture name"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCulture()} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={createCulture} disabled={!newName.trim()}>Add culture</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selected && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete "{selected.name}"?</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>This cannot be undone.</p>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className={styles.addBtn} style={{ background: "var(--color-danger)" }} onClick={deleteCulture}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
