import { useState, useEffect, useCallback } from "react";
import { Plus, ArrowLeftRight, Trash2, ArrowRight, Compass } from "lucide-react";
import { api } from "../../api/client";
import type { Location, LocationTravel } from "../../types";
import styles from "./WorldBuilding.module.css";
import { useUIStore } from "../../stores/uiStore";

interface Props {
  storyId: string;
}

export default function TravelDistanceEditor({ storyId }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [travels, setTravels] = useState<LocationTravel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ from_location_id: "", to_location_id: "", travel_time: "", travel_method: "", condition: "", notes: "", bidirectional: true });

  const load = useCallback(() => {
    Promise.all([
      api.listLocationsFlat(storyId),
      api.listLocationTravel(storyId),
    ]).then(([locs, t]) => {
      setLocations(locs);
      setTravels(t);
    }).finally(() => setLoading(false));
  }, [storyId]);

  useEffect(() => { load(); }, [load]);

  function locationName(id: string) {
    return locations.find((l) => l.id === id)?.name ?? id.slice(0, 8) + "…";
  }

  async function createTravel() {
    if (!form.from_location_id || !form.to_location_id) return;
    await api.createLocationTravel({
      from_location_id: form.from_location_id,
      to_location_id: form.to_location_id,
      travel_time: form.travel_time,
      travel_method: form.travel_method,
      condition: form.condition,
      notes: form.notes,
      bidirectional: form.bidirectional,
    });
    setShowAddModal(false);
    setForm({ from_location_id: "", to_location_id: "", travel_time: "", travel_method: "", condition: "", notes: "", bidirectional: true });
    load();
  }

  async function saveEdit(id: string, data: Partial<LocationTravel>) {
    await api.updateLocationTravel(id, data);
    setEditingId(null);
    load();
  }

  async function deleteTravel(id: string) {
    await api.deleteLocationTravel(id);
    load();
  }

  if (loading) return <div className={styles.loading}>Loading travel data…</div>;

  return (
    <div style={{ padding: "2rem", flex: 1, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 400 }}>Travel Distances</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            Define travel times and methods between locations.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
          <Plus size={12} /> Add travel entry
        </button>
      </div>

      {travels.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          No travel entries yet. Add one to define distances between locations.
        </div>
      ) : (
        <div className={styles.travelGrid}>
          {travels.map((t) => (
            <TravelEntry
              key={t.id}
              travel={t}
              storyId={storyId}
              fromName={locationName(t.from_location_id)}
              toName={locationName(t.to_location_id)}
              isEditing={editingId === t.id}
              onStartEdit={() => setEditingId(t.id)}
              onSave={(data) => saveEdit(t.id, data)}
              onCancel={() => setEditingId(null)}
              onDelete={() => deleteTravel(t.id)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} style={{ width: "480px" }} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add travel entry</h3>
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>From</label>
                <select className={styles.fieldSelect} value={form.from_location_id}
                  onChange={(e) => setForm((f) => ({ ...f, from_location_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>To</label>
                <select className={styles.fieldSelect} value={form.to_location_id}
                  onChange={(e) => setForm((f) => ({ ...f, to_location_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Travel Time</label>
                <input className={styles.fieldInput} placeholder="e.g. 3 days, 2 hours"
                  value={form.travel_time} onChange={(e) => setForm((f) => ({ ...f, travel_time: e.target.value }))} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Method</label>
                <input className={styles.fieldInput} placeholder="e.g. on foot, by ship"
                  value={form.travel_method} onChange={(e) => setForm((f) => ({ ...f, travel_method: e.target.value }))} />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Condition (optional)</label>
              <input className={styles.fieldInput} placeholder="e.g. at opposition, via jump gate, with current tech"
                value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Notes</label>
              <textarea className={styles.fieldTextarea} placeholder="Hazards, terrain, seasonal variations…"
                value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className={styles.fieldGroup}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={form.bidirectional}
                  onChange={(e) => setForm((f) => ({ ...f, bidirectional: e.target.checked }))} />
                Bidirectional (same travel time in both directions)
              </label>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className={styles.addBtn} onClick={createTravel}
                disabled={!form.from_location_id || !form.to_location_id}>
                Add entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TravelEntry({
  travel, storyId, fromName, toName, isEditing, onStartEdit, onSave, onCancel, onDelete,
}: {
  travel: LocationTravel;
  storyId: string;
  fromName: string;
  toName: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (data: Partial<LocationTravel>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { openWorldBuildingAIPanel } = useUIStore();
  const [form, setForm] = useState({
    travel_time: travel.travel_time,
    travel_method: travel.travel_method,
    condition: travel.condition,
    notes: travel.notes,
    bidirectional: travel.bidirectional,
  });

  if (!isEditing) {
    return (
      <div className={styles.travelEntry}>
        <div className={styles.travelLocations}>
          <div className={styles.travelRoute}>
            <span>{fromName}</span>
            {travel.bidirectional
              ? <ArrowLeftRight size={14} color="var(--color-text-muted)" />
              : <ArrowRight size={14} color="var(--color-text-muted)" />}
            <span>{toName}</span>
          </div>
          <div className={styles.travelMeta}>
            {travel.travel_time && <span>{travel.travel_time}</span>}
            {travel.travel_time && travel.travel_method && <span> · </span>}
            {travel.travel_method && <span>{travel.travel_method}</span>}
            {travel.condition && <span style={{ fontStyle: "italic", color: "var(--color-text-subtle)" }}> ({travel.condition})</span>}
            {travel.notes && <span> · {travel.notes}</span>}
          </div>
        </div>
        <button
          className={styles.aiBtn}
          title="Analyzes this route: Journey Considerations, Hazards & Challenges, Narrative Possibilities, and Questions to Consider"
          onClick={() => openWorldBuildingAIPanel({ feature: "travel", entityId: travel.id, storyId })}
        >
          <Compass size={11} />
          Analyze Route
        </button>
        <button className={styles.ghostBtn} onClick={onStartEdit}>Edit</button>
        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    );
  }

  return (
    <div className={styles.travelEntry} style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className={styles.travelRoute} style={{ marginBottom: "0.75rem" }}>
        <strong>{fromName}</strong>
        {form.bidirectional ? <ArrowLeftRight size={14} /> : <ArrowRight size={14} />}
        <strong>{toName}</strong>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Travel Time</label>
          <input className={styles.fieldInput} value={form.travel_time}
            onChange={(e) => setForm((f) => ({ ...f, travel_time: e.target.value }))} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Method</label>
          <input className={styles.fieldInput} value={form.travel_method}
            onChange={(e) => setForm((f) => ({ ...f, travel_method: e.target.value }))} />
        </div>
      </div>
      <div className={styles.fieldGroup}>
        <input className={styles.fieldInput} placeholder="Condition (optional, e.g. at opposition)"
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} />
      </div>
      <div className={styles.fieldGroup}>
        <input className={styles.fieldInput} placeholder="Notes" value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.82rem" }}>
        <input type="checkbox" checked={form.bidirectional}
          onChange={(e) => setForm((f) => ({ ...f, bidirectional: e.target.checked }))} />
        Bidirectional
      </label>
      <div style={{ display: "flex", gap: "0.375rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button className={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.addBtn} onClick={() => onSave(form)}>Save</button>
      </div>
    </div>
  );
}
