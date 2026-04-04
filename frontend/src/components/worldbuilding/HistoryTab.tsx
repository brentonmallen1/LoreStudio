import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Clock, Trash2, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { api } from "../../api/client";
import type { Era, HistoricalEvent } from "../../types";
import styles from "./WorldBuilding.module.css";

interface Props {
  storyId: string;
}

export default function HistoryTab({ storyId }: Props) {
  const [eras, setEras] = useState<Era[]>([]);
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null);
  const [selectedEra, setSelectedEra] = useState<Era | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [showAddEraModal, setShowAddEraModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<"era" | "event" | null>(null);
  const [newName, setNewName] = useState("");
  const [newEraId, setNewEraId] = useState<string | null>(null);
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      api.listEras(storyId),
      api.listHistoricalEvents(storyId),
    ]).then(([e, ev]) => {
      setEras(e);
      setEvents(ev);
      setExpandedEras(new Set(e.map((era) => era.id)));
    }).finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => { load(); }, [load]);

  function scheduleEventUpdate(field: string, value: unknown) {
    if (!selectedEvent) return;
    setSelectedEvent((prev) => prev ? { ...prev, [field]: value } : null);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (!selectedEvent) return;
      api.updateHistoricalEvent(selectedEvent.id, { [field]: value } as Partial<HistoricalEvent>).then(() => load());
    }, 700);
  }

  async function createEra() {
    if (!newName.trim()) return;
    await api.createEra(storyId, { name: newName.trim(), position: eras.length });
    setShowAddEraModal(false); setNewName(""); load();
  }

  async function createEvent() {
    if (!newName.trim()) return;
    const created = await api.createHistoricalEvent(storyId, {
      name: newName.trim(),
      era_id: newEraId,
      position: events.filter((e) => e.era_id === newEraId).length,
    });
    setShowAddEventModal(false); setNewName(""); setNewEraId(null);
    load();
    setSelectedEvent(created);
  }

  async function deleteEra() {
    if (!selectedEra) return;
    await api.deleteEra(selectedEra.id);
    setSelectedEra(null); setShowDeleteConfirm(null); load();
  }

  async function deleteEvent() {
    if (!selectedEvent) return;
    await api.deleteHistoricalEvent(selectedEvent.id);
    setSelectedEvent(null); setShowDeleteConfirm(null); load();
  }

  const orphanEvents = events.filter((e) => !e.era_id);

  if (loading) return <div className={styles.loading}>Loading history…</div>;

  return (
    <div className={styles.manager}>
      {/* Left: Timeline */}
      <div className={styles.sidebar} style={{ width: "320px" }}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Timeline</h3>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button className={styles.ghostBtn} onClick={() => setShowAddEventModal(true)}>
              <Plus size={11} /> Event
            </button>
            <button className={styles.addBtn} onClick={() => setShowAddEraModal(true)}>
              <Plus size={12} /> Era
            </button>
          </div>
        </div>
        <div className={styles.sidebarList} style={{ padding: "0.75rem" }}>
          {eras.length === 0 && orphanEvents.length === 0 && (
            <div className={styles.emptyList}>No history yet</div>
          )}

          {eras.map((era) => {
            const eraEvents = events.filter((e) => e.era_id === era.id);
            const isExpanded = expandedEras.has(era.id);
            return (
              <div key={era.id} className={styles.eraBlock}>
                <div
                  className={styles.eraHeader}
                  onClick={() => {
                    setExpandedEras((prev) => {
                      const next = new Set(prev);
                      if (next.has(era.id)) next.delete(era.id); else next.add(era.id);
                      return next;
                    });
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <div className={styles.eraDot} />
                  <span className={styles.eraName}>{era.name}</span>
                  {era.start_date && (
                    <span className={styles.eraDates}>{era.start_date}{era.end_date ? ` – ${era.end_date}` : ""}</span>
                  )}
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    style={{ marginLeft: "auto", flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); setSelectedEra(era); setShowDeleteConfirm("era"); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {isExpanded && (
                  <div className={styles.eraLine}>
                    {eraEvents.length === 0 ? (
                      <div style={{ fontSize: "0.78rem", color: "var(--color-text-subtle)", padding: "0.25rem 0" }}>
                        No events in this era
                      </div>
                    ) : (
                      eraEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={`${styles.eventItem} ${selectedEvent?.id === ev.id ? styles.eventItemActive : ""}`}
                          onClick={() => setSelectedEvent(ev)}
                        >
                          <div className={styles.eventDot} />
                          <div>
                            <div className={styles.eventName}>{ev.name}</div>
                            {ev.in_world_date && <div className={styles.eventDate}>{ev.in_world_date}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {orphanEvents.length > 0 && (
            <div className={styles.eraBlock}>
              <div className={styles.eraHeader}>
                <BookOpen size={14} color="var(--color-text-muted)" />
                <span className={styles.eraName} style={{ color: "var(--color-text-muted)" }}>Unassigned Events</span>
              </div>
              <div className={styles.eraLine}>
                {orphanEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`${styles.eventItem} ${selectedEvent?.id === ev.id ? styles.eventItemActive : ""}`}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <div className={styles.eventDot} />
                    <div>
                      <div className={styles.eventName}>{ev.name}</div>
                      {ev.in_world_date && <div className={styles.eventDate}>{ev.in_world_date}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Event detail */}
      <div className={styles.detail}>
        {!selectedEvent ? (
          <div className={styles.detailEmpty}>
            <Clock size={24} color="var(--color-text-subtle)" />
            <span>Select an event to view details</span>
          </div>
        ) : (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailName}>{selectedEvent.name}</h2>
              <div className={styles.detailActions}>
                <button className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={() => setShowDeleteConfirm("event")}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Name</label>
                <input className={styles.fieldInput} value={selectedEvent.name}
                  onChange={(e) => scheduleEventUpdate("name", e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>In-World Date</label>
                <input className={styles.fieldInput}
                  placeholder="e.g. Year 312, Third Moon…"
                  value={selectedEvent.in_world_date}
                  onChange={(e) => scheduleEventUpdate("in_world_date", e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Era</label>
              <select className={styles.fieldSelect}
                value={selectedEvent.era_id ?? ""}
                onChange={(e) => scheduleEventUpdate("era_id", e.target.value || null)}>
                <option value="">— no era —</option>
                {eras.map((era) => <option key={era.id} value={era.id}>{era.name}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea className={styles.fieldTextarea}
                placeholder="What happened?"
                value={selectedEvent.description}
                onChange={(e) => scheduleEventUpdate("description", e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Causes</label>
                <textarea className={styles.fieldTextarea}
                  placeholder="What led to this event?"
                  value={selectedEvent.causes}
                  onChange={(e) => scheduleEventUpdate("causes", e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Consequences</label>
                <textarea className={styles.fieldTextarea}
                  placeholder="What were the immediate effects?"
                  value={selectedEvent.consequences}
                  onChange={(e) => scheduleEventUpdate("consequences", e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Legacy Effects</label>
              <textarea className={styles.fieldTextarea}
                placeholder="How does this event still shape the present day?"
                value={selectedEvent.legacy_effects}
                onChange={(e) => scheduleEventUpdate("legacy_effects", e.target.value)} />
            </div>
          </>
        )}
      </div>

      {showAddEraModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddEraModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add era</h3>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Name</label>
              <input className={styles.fieldInput} autoFocus placeholder="Era name"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createEra()} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowAddEraModal(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={createEra} disabled={!newName.trim()}>Add era</button>
            </div>
          </div>
        </div>
      )}

      {showAddEventModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddEventModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add event</h3>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Name</label>
              <input className={styles.fieldInput} autoFocus placeholder="Event name"
                value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Era (optional)</label>
              <select className={styles.fieldSelect} value={newEraId ?? ""}
                onChange={(e) => setNewEraId(e.target.value || null)}>
                <option value="">— unassigned —</option>
                {eras.map((era) => <option key={era.id} value={era.id}>{era.name}</option>)}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowAddEventModal(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={createEvent} disabled={!newName.trim()}>Add event</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm === "era" && selectedEra && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete era "{selectedEra.name}"?</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
              Events in this era will become unassigned, not deleted.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className={styles.addBtn} style={{ background: "var(--color-danger)" }} onClick={deleteEra}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm === "event" && selectedEvent && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete "{selectedEvent.name}"?</h3>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className={styles.addBtn} style={{ background: "var(--color-danger)" }} onClick={deleteEvent}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
