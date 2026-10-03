import { useEffect, useState } from "react";
import { Plus, Trash2, X, GripVertical, Check } from "lucide-react";
import { api } from "../../api/client";
import type { Beat, BeatSheet } from "../../types";
import styles from "./BeatSheetManagerDialog.module.css";

interface Props {
  onClose: () => void;
  onSheetsChanged: () => void;
}

function newBeat(): Beat {
  return { id: crypto.randomUUID(), name: "", position_pct: 50, description: "" };
}

function EditView({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<BeatSheet> | null;
  onSave: (sheet: BeatSheet) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [beats, setBeats] = useState<Beat[]>(initial?.beats?.length ? [...initial.beats] : [newBeat()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateBeat(id: string, field: keyof Beat, value: string | number) {
    setBeats((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  function addBeat() {
    setBeats((prev) => [...prev, newBeat()]);
  }

  function removeBeat(id: string) {
    setBeats((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const validBeats = beats.filter((b) => b.name.trim());
    setSaving(true);
    try {
      let sheet: BeatSheet;
      if (initial?.id) {
        sheet = await api.updateBeatSheet(initial.id, { name: name.trim(), description, beats: validBeats });
      } else {
        sheet = await api.createBeatSheet({ name: name.trim(), description, beats: validBeats });
      }
      onSave(sheet);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editView}>
      <div className={styles.field}>
        <label className={styles.label}>Name</label>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My beat sheet"
          autoFocus
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Description</label>
        <input
          className={styles.input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description…"
        />
      </div>

      <div className={styles.beatsSection}>
        <div className={styles.beatsHeader}>
          <span className={styles.label}>Beats</span>
          <button className={styles.addBeatBtn} onClick={addBeat}>
            <Plus size={11} /> Add beat
          </button>
        </div>
        <div className={styles.beatTable}>
          <div className={styles.beatTableHead}>
            <span />
            <span>Position %</span>
            <span>Name</span>
            <span>Description</span>
            <span />
          </div>
          {beats.map((beat) => (
            <div key={beat.id} className={styles.beatRow}>
              <span className={styles.dragHandle}>
                <GripVertical size={12} />
              </span>
              <input
                className={`${styles.input} ${styles.pctInput}`}
                type="number"
                min={0}
                max={100}
                value={beat.position_pct}
                onChange={(e) => updateBeat(beat.id, "position_pct", parseFloat(e.target.value) || 0)}
              />
              <input
                className={styles.input}
                value={beat.name}
                onChange={(e) => updateBeat(beat.id, "name", e.target.value)}
                placeholder="Beat name"
              />
              <input
                className={styles.input}
                value={beat.description}
                onChange={(e) => updateBeat(beat.id, "description", e.target.value)}
                placeholder="Optional description"
              />
              <button
                aria-label="Remove this beat"
                className={styles.removeBeatBtn}
                onClick={() => removeBeat(beat.id)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.editActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          <Check size={13} />
          {saving ? "Saving…" : "Save beat sheet"}
        </button>
      </div>
    </div>
  );
}

export default function BeatSheetManagerDialog({ onClose, onSheetsChanged }: Props) {
  const [sheets, setSheets] = useState<BeatSheet[]>([]);
  const [editing, setEditing] = useState<BeatSheet | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listBeatSheets()
      .then((all) => setSheets(all.filter((s) => !s.is_system)))
      .catch(() => {});
  }, []);

  async function doDelete(id: string) {
    setPendingDeleteId(null);
    setDeletingId(id);
    await api.deleteBeatSheet(id).catch(() => {});
    setSheets((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
    onSheetsChanged();
  }

  function handleSaved(sheet: BeatSheet) {
    setSheets((prev) => {
      const exists = prev.find((s) => s.id === sheet.id);
      return exists ? prev.map((s) => (s.id === sheet.id ? sheet : s)) : [...prev, sheet];
    });
    setEditing(null);
    onSheetsChanged();
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>Custom beat sheets</h2>
          <button aria-label="Close" className={styles.closeBtn} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {editing ? (
          <EditView
            initial={editing === "new" ? null : editing}
            onSave={handleSaved}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.listView}>
            <p className={styles.hint}>
              Create your own beat sheet frameworks with custom beats at specific story positions.
            </p>
            {sheets.length === 0 ? (
              <div className={styles.empty}>No custom beat sheets yet</div>
            ) : (
              <div className={styles.sheetList}>
                {sheets.map((sheet) => (
                  <div key={sheet.id} className={styles.sheetCard}>
                    <div className={styles.sheetInfo}>
                      <span className={styles.sheetName}>{sheet.name}</span>
                      <span className={styles.sheetBeats}>{sheet.beats.length} beats</span>
                      {sheet.description && <span className={styles.sheetDesc}>{sheet.description}</span>}
                    </div>
                    <div className={styles.sheetActions}>
                      <button className={styles.editBtn} onClick={() => setEditing(sheet)}>
                        Edit
                      </button>
                      {pendingDeleteId === sheet.id ? (
                        <div className={styles.deleteConfirm}>
                          <button className={styles.deleteConfirmYes} onClick={() => doDelete(sheet.id)}>
                            Delete
                          </button>
                          <button className={styles.deleteConfirmNo} onClick={() => setPendingDeleteId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          aria-label="Delete this beat sheet"
                          className={styles.deleteBtn}
                          onClick={() => setPendingDeleteId(sheet.id)}
                          disabled={deletingId === sheet.id}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className={styles.newBtn} onClick={() => setEditing("new")}>
              <Plus size={13} /> New beat sheet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
