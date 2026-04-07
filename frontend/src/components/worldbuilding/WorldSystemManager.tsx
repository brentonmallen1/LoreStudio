import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Zap, Trash2, ChevronDown, ChevronUp, AlertCircle, Lightbulb, AlertTriangle, HelpCircle } from "lucide-react";
import { api } from "../../api/client";
import type { WorldSystem } from "../../types";
import styles from "./WorldBuilding.module.css";
import WorldAIStructuredPanel from "./WorldAIStructuredPanel";
import type { SectionConfig } from "../ai/StructuredResponseRenderer";

const SYSTEM_ANALYSIS_SCHEMA: SectionConfig[] = [
  { key: "edge_cases", label: "Edge Cases", icon: AlertCircle, color: "var(--color-accent)", type: "list" },
  { key: "story_implications", label: "Story Implications", icon: Lightbulb, color: "var(--segment-part)", type: "list" },
  { key: "consistency_questions", label: "Consistency Questions", icon: AlertTriangle, color: "var(--color-warning)", type: "list" },
  { key: "questions", label: "Questions to Consider", icon: HelpCircle, color: "var(--color-ai)", type: "list" },
];

interface Props {
  storyId: string;
}

const PREDEFINED_TYPES = ["magic", "technology", "power", "social", "economic", "religious", "natural"];

export default function WorldSystemManager({ storyId }: Props) {
  const [systems, setSystems] = useState<WorldSystem[]>([]);
  const [selected, setSelected] = useState<WorldSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<string[]>(PREDEFINED_TYPES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newCustomType, setNewCustomType] = useState("");
  const [expandedTiers, setExpandedTiers] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setShowAI(false); }, [selected?.id]);

  const load = useCallback(() => {
    Promise.all([
      api.listWorldSystems(storyId),
      api.getSystemTypes(storyId),
    ]).then(([s, types]) => {
      setSystems(s);
      setAvailableTypes(types.length ? types : PREDEFINED_TYPES);
    }).finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => { load(); }, [load]);

  function scheduleUpdate(field: string, value: unknown) {
    if (!selected) return;
    setSelected((prev) => prev ? { ...prev, [field]: value } : null);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (!selected) return;
      api.updateWorldSystem(selected.id, { [field]: value } as Partial<WorldSystem>).then(() => load());
    }, 700);
  }

  async function createSystem() {
    if (!newName.trim()) return;
    const type = newType === "__custom__" ? newCustomType.trim() : newType;
    const created = await api.createWorldSystem(storyId, { name: newName.trim(), system_type: type });
    setShowAddModal(false);
    setNewName(""); setNewType(""); setNewCustomType("");
    load();
    setSelected(created);
  }

  async function deleteSystem() {
    if (!selected) return;
    await api.deleteWorldSystem(selected.id);
    setSelected(null);
    setShowDeleteConfirm(false);
    load();
  }

  function addTier() {
    if (!selected) return;
    const tiers = [...selected.hierarchy_tiers, { name: `Tier ${selected.hierarchy_tiers.length + 1}`, description: "", examples: [] }];
    scheduleUpdate("hierarchy_tiers", tiers);
  }

  function updateTier(idx: number, field: string, value: string) {
    if (!selected) return;
    const tiers = selected.hierarchy_tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t);
    scheduleUpdate("hierarchy_tiers", tiers);
  }

  function removeTier(idx: number) {
    if (!selected) return;
    const tiers = selected.hierarchy_tiers.filter((_, i) => i !== idx);
    scheduleUpdate("hierarchy_tiers", tiers);
  }

  if (loading) return <div className={styles.loading}>Loading systems…</div>;

  return (
    <div className={styles.manager}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Systems</h3>
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <Plus size={12} /> Add
          </button>
        </div>
        <div className={styles.sidebarList}>
          {systems.length === 0 ? (
            <div className={styles.emptyList}>No systems yet</div>
          ) : (
            systems.map((s) => (
              <div
                key={s.id}
                className={`${styles.listItem} ${selected?.id === s.id ? styles.listItemActive : ""}`}
                onClick={() => setSelected(s)}
              >
                <Zap size={12} color="var(--color-text-muted)" />
                <span className={styles.listItemName}>{s.name}</span>
                {s.system_type && <span className={styles.listItemBadge}>{s.system_type}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.detail}>
        {!selected ? (
          <div className={styles.detailEmpty}>
            <Zap size={24} color="var(--color-text-subtle)" />
            <span>Select a system to view details</span>
          </div>
        ) : (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailName}>{selected.name}</h2>
              <div className={styles.detailActions}>
                <button
                  className={styles.ghostBtn}
                  onClick={() => setShowAI((v) => !v)}
                  style={{ fontSize: "0.72rem" }}
                >
                  Analyze System
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  title="Delete system"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Name</label>
                <input className={styles.fieldInput} value={selected.name}
                  onChange={(e) => scheduleUpdate("name", e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Type</label>
                <select
                  className={styles.fieldSelect}
                  value={selected.system_type}
                  onChange={(e) => scheduleUpdate("system_type", e.target.value)}
                >
                  <option value="">— select type —</option>
                  {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Source / Origin</label>
              <textarea className={styles.fieldTextarea}
                placeholder="Where does this system come from? What is its basis?"
                value={selected.source_origin}
                onChange={(e) => scheduleUpdate("source_origin", e.target.value)} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Rules</label>
              <textarea className={styles.fieldTextarea}
                style={{ minHeight: "7rem" }}
                placeholder="How does this system work? What are the mechanics?"
                value={selected.rules}
                onChange={(e) => scheduleUpdate("rules", e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Limitations</label>
                <textarea className={styles.fieldTextarea}
                  placeholder="What can't it do? What restricts its use?"
                  value={selected.limitations}
                  onChange={(e) => scheduleUpdate("limitations", e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Costs</label>
                <textarea className={styles.fieldTextarea}
                  placeholder="What does it cost to use? Physical, mental, social?"
                  value={selected.costs}
                  onChange={(e) => scheduleUpdate("costs", e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Notes</label>
              <textarea className={styles.fieldTextarea}
                placeholder="Anything else worth noting about this system…"
                value={selected.notes}
                onChange={(e) => scheduleUpdate("notes", e.target.value)} />
            </div>

            <hr className={styles.divider} />

            <div className={styles.fieldGroup}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <label className={styles.fieldLabel} style={{ margin: 0 }}>
                  Hierarchy / Tiers
                  {selected.hierarchy_tiers.length > 0 && ` (${selected.hierarchy_tiers.length})`}
                </label>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  {selected.hierarchy_tiers.length > 0 && (
                    <button className={styles.ghostBtn} onClick={() => setExpandedTiers(!expandedTiers)}>
                      {expandedTiers ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expandedTiers ? "Collapse" : "Expand"}
                    </button>
                  )}
                  <button className={styles.ghostBtn} onClick={addTier}>
                    <Plus size={12} /> Add tier
                  </button>
                </div>
              </div>
              {selected.hierarchy_tiers.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  No tiers defined. Add tiers to represent power levels, ranks, or categories in this system.
                </p>
              ) : (expandedTiers || selected.hierarchy_tiers.length <= 3) && (
                <div className={styles.tierList}>
                  {selected.hierarchy_tiers.map((tier, i) => (
                    <div key={i} className={styles.tierItem}>
                      <span className={styles.tierNumber}>{i + 1}</span>
                      <div className={styles.tierBody}>
                        <input
                          className={styles.fieldInput}
                          placeholder="Tier name"
                          value={tier.name}
                          onChange={(e) => updateTier(i, "name", e.target.value)}
                          style={{ marginBottom: "0.375rem" }}
                        />
                        <input
                          className={styles.fieldInput}
                          placeholder="Description"
                          value={tier.description}
                          onChange={(e) => updateTier(i, "description", e.target.value)}
                        />
                      </div>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => removeTier(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showAI && (
              <WorldAIStructuredPanel
                title="System Analysis"
                description="Surface edge cases, story implications, and consistency questions for this world system."
                buttonLabel="Analyze"
                requestId={`system-analysis-${selected.id}`}
                schema={SYSTEM_ANALYSIS_SCHEMA}
                onAnalyze={() => api.analyzeWorldSystem(storyId, selected.id)}
              />
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add world system</h3>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Name</label>
              <input className={styles.fieldInput} autoFocus placeholder="System name"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSystem()} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Type</label>
              <select className={styles.fieldSelect} value={newType} onChange={(e) => setNewType(e.target.value)}>
                <option value="">— select type —</option>
                {PREDEFINED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">Custom…</option>
              </select>
              {newType === "__custom__" && (
                <input className={styles.fieldInput} style={{ marginTop: "0.5rem" }}
                  placeholder="Enter custom type" value={newCustomType}
                  onChange={(e) => setNewCustomType(e.target.value)} />
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={createSystem} disabled={!newName.trim()}>Add system</button>
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
              <button className={styles.addBtn} style={{ background: "var(--color-danger)" }} onClick={deleteSystem}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
