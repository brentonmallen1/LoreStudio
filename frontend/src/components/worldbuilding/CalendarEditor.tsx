import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Calendar as CalendarIcon, Trash2, PartyPopper, Sun, Clock, HelpCircle } from "lucide-react";
import { api } from "../../api/client";
import type { Calendar } from "../../types";
import styles from "./WorldBuilding.module.css";
import WorldAIStructuredPanel from "./WorldAIStructuredPanel";
import type { SectionConfig } from "../ai/StructuredResponseRenderer";

const CALENDAR_SUGGEST_SCHEMA: SectionConfig[] = [
  { key: "festivals", label: "Festivals & Celebrations", icon: PartyPopper, color: "var(--color-accent)", type: "list" },
  { key: "seasonal_events", label: "Seasonal Events", icon: Sun, color: "var(--segment-part)", type: "list" },
  { key: "historical_observances", label: "Historical Observances", icon: Clock, color: "var(--color-warning)", type: "list" },
  { key: "questions", label: "Questions to Consider", icon: HelpCircle, color: "var(--color-ai)", type: "list" },
];

interface Props {
  storyId: string;
}

export default function CalendarEditor({ storyId }: Props) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selected, setSelected] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAI, setShowAI] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setShowAI(false); }, [selected?.id]);

  const load = useCallback(() => {
    api.listCalendars(storyId).then(setCalendars).finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => { load(); }, [load]);

  function scheduleUpdate(field: string, value: unknown) {
    if (!selected) return;
    setSelected((prev) => prev ? { ...prev, [field]: value } : null);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (!selected) return;
      api.updateCalendar(selected.id, { [field]: value } as Partial<Calendar>).then(() => load());
    }, 700);
  }

  async function createCalendar() {
    if (!newName.trim()) return;
    const created = await api.createCalendar(storyId, { name: newName.trim() });
    setShowAddModal(false); setNewName("");
    load(); setSelected(created);
  }

  async function deleteCalendar() {
    if (!selected) return;
    await api.deleteCalendar(selected.id);
    setSelected(null); setShowDeleteConfirm(false); load();
  }

  function addMonth() {
    if (!selected) return;
    const months = [...selected.months, { name: `Month ${selected.months.length + 1}`, days: 30 }];
    scheduleUpdate("months", months);
  }

  function updateMonth(idx: number, field: string, value: string | number) {
    if (!selected) return;
    const months = selected.months.map((m, i) => i === idx ? { ...m, [field]: value } : m);
    scheduleUpdate("months", months);
  }

  function removeMonth(idx: number) {
    if (!selected) return;
    scheduleUpdate("months", selected.months.filter((_, i) => i !== idx));
  }

  function addSpecialDay() {
    if (!selected) return;
    const special_days = [...selected.special_days, { name: "", month: 1, day: 1, description: "" }];
    scheduleUpdate("special_days", special_days);
  }

  function updateSpecialDay(idx: number, field: string, value: string | number) {
    if (!selected) return;
    const special_days = selected.special_days.map((d, i) => i === idx ? { ...d, [field]: value } : d);
    scheduleUpdate("special_days", special_days);
  }

  function removeSpecialDay(idx: number) {
    if (!selected) return;
    scheduleUpdate("special_days", selected.special_days.filter((_, i) => i !== idx));
  }

  if (loading) return <div className={styles.loading}>Loading calendars…</div>;

  return (
    <div className={styles.manager}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Calendars</h3>
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <Plus size={12} /> Add
          </button>
        </div>
        <div className={styles.sidebarList}>
          {calendars.length === 0 ? (
            <div className={styles.emptyList}>No calendars yet</div>
          ) : (
            calendars.map((c) => (
              <div key={c.id}
                className={`${styles.listItem} ${selected?.id === c.id ? styles.listItemActive : ""}`}
                onClick={() => setSelected(c)}>
                <CalendarIcon size={12} color="var(--color-text-muted)" />
                <span className={styles.listItemName}>{c.name}</span>
                {c.epoch_name && <span className={styles.listItemBadge}>{c.epoch_name}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.detail}>
        {!selected ? (
          <div className={styles.detailEmpty}>
            <CalendarIcon size={24} color="var(--color-text-subtle)" />
            <span>Select a calendar to view details</span>
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
                  Suggest Events
                </button>
                <button className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={() => setShowDeleteConfirm(true)}>
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
                <label className={styles.fieldLabel}>Epoch Name</label>
                <input className={styles.fieldInput}
                  placeholder="e.g. After the Sundering…"
                  value={selected.epoch_name}
                  onChange={(e) => scheduleUpdate("epoch_name", e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea className={styles.fieldTextarea}
                placeholder="Overview of this calendar system…"
                value={selected.description}
                onChange={(e) => scheduleUpdate("description", e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Days per week</label>
                <input className={styles.fieldInput} type="number" min={1} max={20}
                  value={selected.days_per_week}
                  onChange={(e) => scheduleUpdate("days_per_week", parseInt(e.target.value) || 7)} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Week day names (comma-separated)</label>
                <input className={styles.fieldInput}
                  placeholder="e.g. Moonday, Fireday, Earthday…"
                  value={selected.week_day_names.join(", ")}
                  onChange={(e) => scheduleUpdate("week_day_names",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              </div>
            </div>

            <hr className={styles.divider} />

            <div className={styles.fieldGroup}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <label className={styles.fieldLabel} style={{ margin: 0 }}>
                  Months ({selected.months.length})
                </label>
                <button className={styles.ghostBtn} onClick={addMonth}>
                  <Plus size={12} /> Add month
                </button>
              </div>
              {selected.months.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  No months defined yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selected.months.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", minWidth: "1.5rem" }}>{i + 1}.</span>
                      <input className={styles.fieldInput} style={{ flex: 2 }}
                        placeholder="Month name" value={m.name}
                        onChange={(e) => updateMonth(i, "name", e.target.value)} />
                      <input className={styles.fieldInput} style={{ flex: 1 }} type="number" min={1}
                        placeholder="Days" value={m.days}
                        onChange={(e) => updateMonth(i, "days", parseInt(e.target.value) || 30)} />
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", minWidth: "2rem" }}>days</span>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => removeMonth(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className={styles.monthGrid}>
                    {selected.months.map((m, i) => (
                      <span key={i} className={styles.monthChip}>
                        {m.name} <span style={{ color: "var(--color-text-subtle)" }}>{m.days}d</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <hr className={styles.divider} />

            <div className={styles.fieldGroup}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <label className={styles.fieldLabel} style={{ margin: 0 }}>
                  Special Days ({selected.special_days.length})
                </label>
                <button className={styles.ghostBtn} onClick={addSpecialDay}>
                  <Plus size={12} /> Add special day
                </button>
              </div>
              {selected.special_days.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input className={styles.fieldInput} style={{ flex: 2 }}
                        placeholder="Day name" value={d.name}
                        onChange={(e) => updateSpecialDay(i, "name", e.target.value)} />
                      <input className={styles.fieldInput} style={{ flex: 1 }} type="number"
                        placeholder="Month" value={d.month}
                        onChange={(e) => updateSpecialDay(i, "month", parseInt(e.target.value) || 1)} />
                      <input className={styles.fieldInput} style={{ flex: 1 }} type="number"
                        placeholder="Day" value={d.day}
                        onChange={(e) => updateSpecialDay(i, "day", parseInt(e.target.value) || 1)} />
                    </div>
                    <input className={styles.fieldInput}
                      placeholder="Description (optional)" value={d.description}
                      onChange={(e) => updateSpecialDay(i, "description", e.target.value)} />
                  </div>
                  <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => removeSpecialDay(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Conversion Notes</label>
              <textarea className={styles.fieldTextarea}
                placeholder="How does this calendar relate to narrative time? How to convert dates?"
                value={selected.conversion_notes}
                onChange={(e) => scheduleUpdate("conversion_notes", e.target.value)} />
            </div>

            {showAI && (
              <WorldAIStructuredPanel
                title="Calendar Event Suggestions"
                description="Generate ideas for festivals, seasonal events, and historical observances rooted in this calendar's culture and history."
                buttonLabel="Suggest"
                requestId={`calendar-suggest-${selected.id}`}
                schema={CALENDAR_SUGGEST_SCHEMA}
                onAnalyze={() => api.suggestCalendarEvents(storyId, selected.id)}
              />
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add calendar</h3>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Name</label>
              <input className={styles.fieldInput} autoFocus placeholder="Calendar name"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCalendar()} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={createCalendar} disabled={!newName.trim()}>Add calendar</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selected && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete "{selected.name}"?</h3>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className={styles.addBtn} style={{ background: "var(--color-danger)" }} onClick={deleteCalendar}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
