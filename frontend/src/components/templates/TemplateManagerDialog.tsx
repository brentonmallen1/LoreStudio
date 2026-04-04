import { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Check, GripVertical, LayoutTemplate } from "lucide-react";
import { api } from "../../api/client";
import type { StoryStructureTemplate } from "../../types";
import { Modal } from "../common";
import styles from "./TemplateManagerDialog.module.css";

interface Props {
  onClose: () => void;
  onTemplatesChanged?: () => void;
}

interface LevelDraft {
  name: string;
  plural: string;
}

export default function TemplateManagerDialog({ onClose, onTemplatesChanged }: Props) {
  const [templates, setTemplates] = useState<StoryStructureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Draft state for create/edit
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftLevels, setDraftLevels] = useState<LevelDraft[]>([
    { name: "", plural: "" },
  ]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const ts = await api.listStructureTemplates();
      setTemplates(ts);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setDraftName("");
    setDraftDesc("");
    setDraftLevels([{ name: "", plural: "" }]);
  }

  function startEdit(t: StoryStructureTemplate) {
    setEditingId(t.id);
    setCreating(false);
    setDraftName(t.name);
    setDraftDesc(t.description);
    setDraftLevels(t.levels.map((l) => ({ name: l.name, plural: l.plural })));
  }

  function addLevel() {
    setDraftLevels((prev) => [...prev, { name: "", plural: "" }]);
  }

  function removeLevel(i: number) {
    setDraftLevels((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLevel(i: number, key: keyof LevelDraft, value: string) {
    setDraftLevels((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }

  async function handleCreate() {
    const validLevels = draftLevels.filter((l) => l.name.trim());
    if (!draftName.trim() || validLevels.length === 0) return;
    const t = await api.createStructureTemplate({
      name: draftName.trim(),
      description: draftDesc.trim(),
      levels: validLevels.map((l) => ({
        name: l.name.trim(),
        plural: l.plural.trim() || l.name.trim() + "s",
      })),
    });
    setTemplates((prev) => [...prev, t]);
    setCreating(false);
    onTemplatesChanged?.();
  }

  async function handleSaveEdit(id: string) {
    const validLevels = draftLevels.filter((l) => l.name.trim());
    if (!draftName.trim() || validLevels.length === 0) return;
    const updated = await api.updateStructureTemplate(id, {
      name: draftName.trim(),
      description: draftDesc.trim(),
      levels: validLevels.map((l) => ({
        name: l.name.trim(),
        plural: l.plural.trim() || l.name.trim() + "s",
      })),
    });
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
    onTemplatesChanged?.();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    await api.deleteStructureTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    onTemplatesChanged?.();
  }

  const userTemplates = templates.filter((t) => !t.is_system);
  const systemTemplates = templates.filter((t) => t.is_system);

  function renderLevelEditor() {
    return (
      <div className={styles.levelEditor}>
        <p className={styles.levelHint}>Define the hierarchy levels (e.g. Act → Chapter → Scene).</p>
        {draftLevels.map((l, i) => (
          <div key={i} className={styles.levelRow}>
            <GripVertical size={12} className={styles.gripIcon} />
            <input
              value={l.name}
              onChange={(e) => updateLevel(i, "name", e.target.value)}
              placeholder="Level name (e.g. Act)"
              className={styles.levelInput}
            />
            <input
              value={l.plural}
              onChange={(e) => updateLevel(i, "plural", e.target.value)}
              placeholder="Plural (e.g. Acts)"
              className={styles.levelInput}
            />
            {draftLevels.length > 1 && (
              <button onClick={() => removeLevel(i)} className={styles.removeLevelBtn} aria-label="Remove level">
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        <button onClick={addLevel} className={styles.addLevelBtn}>
          <Plus size={11} /> Add level
        </button>
      </div>
    );
  }

  const footer = (
    <button onClick={onClose} className={styles.doneBtn}>Done</button>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Structure Templates"
      icon={<LayoutTemplate size={15} />}
      size="md"
      footer={footer}
      zIndex={60}
    >
      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : (
        <div className={styles.content}>
          {/* Custom templates section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>My Templates</span>
              <button onClick={startCreate} className={styles.newBtn}>
                <Plus size={12} /> New
              </button>
            </div>

            {creating && (
              <div className={styles.editCard}>
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Template name…"
                  className={styles.nameInput}
                />
                <input
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className={styles.nameInput}
                />
                {renderLevelEditor()}
                <div className={styles.editActions}>
                  <button onClick={() => setCreating(false)} className={styles.cancelBtn}>Cancel</button>
                  <button
                    onClick={handleCreate}
                    disabled={!draftName.trim() || draftLevels.every((l) => !l.name.trim())}
                    className={styles.saveBtn}
                  >
                    <Check size={12} /> Create
                  </button>
                </div>
              </div>
            )}

            {userTemplates.length === 0 && !creating && (
              <p className={styles.empty}>No custom templates yet.</p>
            )}

            {userTemplates.map((t) => (
              <div key={t.id} className={styles.templateCard}>
                {editingId === t.id ? (
                  <div className={styles.editCard}>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Template name"
                      className={styles.nameInput}
                    />
                    <input
                      value={draftDesc}
                      onChange={(e) => setDraftDesc(e.target.value)}
                      placeholder="Description"
                      className={styles.nameInput}
                    />
                    {renderLevelEditor()}
                    <div className={styles.editActions}>
                      <button onClick={() => setEditingId(null)} className={styles.cancelBtn}>Cancel</button>
                      <button onClick={() => handleSaveEdit(t.id)} className={styles.saveBtn}>
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.templateInfo}>
                      <span className={styles.templateName}>{t.name}</span>
                      {t.description && <p className={styles.templateDesc}>{t.description}</p>}
                      <p className={styles.templateLevels}>
                        {t.levels.map((l) => l.name).join(" → ")}
                      </p>
                    </div>
                    <div className={styles.templateActions}>
                      <button onClick={() => startEdit(t)} className={styles.iconBtn} aria-label="Edit">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className={`${styles.iconBtn} ${styles.danger}`} aria-label="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* System templates (read-only preview) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Built-in Templates</span>
            </div>
            {systemTemplates.map((t) => (
              <div key={t.id} className={`${styles.templateCard} ${styles.systemCard}`}>
                <div className={styles.templateInfo}>
                  <span className={styles.templateName}>{t.name}</span>
                  {t.description && <p className={styles.templateDesc}>{t.description}</p>}
                  <p className={styles.templateLevels}>
                    {t.levels.map((l: { name: string; plural: string }) => l.name).join(" → ")}
                  </p>
                </div>
                <span className={styles.systemBadge}>built-in</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
