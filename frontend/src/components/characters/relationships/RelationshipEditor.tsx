import { useEffect, useRef, useState } from "react";
import { X, Eye, EyeOff, Layers } from "lucide-react";
import { api } from "../../../api/client";
import { SectionCard } from "../../common";
import type {
  Character,
  CharacterRelationship,
  RelationshipTemplate,
  StrengthDimensions,
} from "../../../types";
import StrengthSliders from "./StrengthSliders";
import NarrativePurposeTags from "./NarrativePurposeTags";
import TemplateSelector from "./TemplateSelector";
import styles from "./RelationshipEditor.module.css";

const RELATIONSHIP_TYPES = [
  "acquaintance",
  "ally",
  "mentor",
  "rival",
  "enemy",
  "romantic",
  "family",
  "confidant",
  "authority",
  "foil",
  "protector",
  "former ally",
  "custom",
];

const DEFAULT_STRENGTH: StrengthDimensions = { trust: 5, power: 5, affection: 5, tension: 5, openness: 5 };

interface Props {
  characterId: string;
  characters: Character[];
  relationship: CharacterRelationship | null;
  existingRelationships?: CharacterRelationship[]; // already-created relationships for the focus character
  onClose: () => void;
  onSaved: (rel: CharacterRelationship) => void;
  onDeleted?: (id: string) => void;
}

export default function RelationshipEditor({
  characterId,
  characters,
  relationship,
  existingRelationships = [],
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const isNew = relationship === null;

  const [panelWidth, setPanelWidth] = useState(400);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(400);

  const [targetId, setTargetId] = useState(relationship?.related_character_id ?? "");
  const [type, setType] = useState(relationship?.relationship_type ?? "acquaintance");
  const [customType, setCustomType] = useState("");
  const [strength, setStrength] = useState<StrengthDimensions>(relationship?.strength ?? DEFAULT_STRENGTH);
  const [visibility, setVisibility] = useState<"public" | "hidden">(relationship?.visibility ?? "public");
  const [purposes, setPurposes] = useState<string[]>(relationship?.narrative_purpose ?? []);
  const [description, setDescription] = useState(relationship?.description ?? "");
  const [notes, setNotes] = useState(relationship?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [purposeError, setPurposeError] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(false);

  const [templates, setTemplates] = useState<RelationshipTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    api
      .getRelationshipTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const dx = resizeStartX.current - e.clientX;
      setPanelWidth(Math.max(300, Math.min(580, resizeStartWidth.current + dx)));
    }
    function onMouseUp() {
      isResizing.current = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function startResize(e: React.MouseEvent) {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
    e.preventDefault();
  }

  function applyTemplate(t: RelationshipTemplate) {
    setType(t.relationship_type);
    setStrength({ ...t.default_strength });
    setVisibility(t.default_visibility);
    setPurposes([...t.default_narrative_purpose]);
    setShowTemplates(false);
  }

  async function handleSave() {
    if (purposes.length === 0) {
      setPurposeError(true);
      return;
    }
    setPurposeError(false);
    setSaveError("");
    setSaving(true);
    try {
      const resolvedType = type === "custom" ? customType.trim() || "custom" : type;
      const payload = {
        relationship_type: resolvedType,
        description,
        strength,
        visibility,
        narrative_purpose: purposes,
        notes,
      };
      let saved: CharacterRelationship;
      if (isNew) {
        if (!targetId) return;
        saved = await api.createRelationship(characterId, { related_character_id: targetId, ...payload });
      } else {
        saved = await api.updateRelationship(relationship!.id, payload);
      }
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        setSaveError(
          "A relationship from this character to the selected character already exists. Edit the existing one instead.",
        );
      } else {
        setSaveError("Failed to save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!relationship) return;
    setPendingDelete(false);
    await api.deleteRelationship(relationship.id);
    onDeleted?.(relationship.id);
    onClose();
  }

  // Characters already related from this character's directed perspective
  const alreadyRelatedIds = new Set(existingRelationships.map((r) => r.related_character_id));
  const otherChars = characters.filter((c) => c.id !== characterId);
  // In create mode, exclude characters that already have a directed relationship from this character
  const availableTargets = isNew ? otherChars.filter((c) => !alreadyRelatedIds.has(c.id)) : otherChars;
  const targetChar = characters.find((c) => c.id === (isNew ? targetId : relationship?.related_character_id));
  const selfChar = characters.find((c) => c.id === characterId);

  return (
    <aside className={styles.panel} style={{ width: panelWidth }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />

      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Layers size={14} />
          <span>{isNew ? "New Relationship" : "Edit Relationship"}</span>
          {!isNew && targetChar && selfChar && (
            <span className={styles.direction}>
              {selfChar.name} → {targetChar.name}
            </span>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className={styles.body}>
        {/* Target character (create mode only) */}
        {isNew && (
          <div className={styles.field}>
            <label className={styles.label}>Target Character *</label>
            <select className={styles.select} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select a character…</option>
              {availableTargets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {availableTargets.length === 0 && (
              <p className={styles.fieldHint}>
                All characters already have a relationship from this character.
              </p>
            )}
          </div>
        )}

        {/* Templates */}
        <SectionCard
          title="Quick templates"
          collapsed={!showTemplates}
          onToggle={() => setShowTemplates((v) => !v)}
        >
          <TemplateSelector templates={templates} onSelect={applyTemplate} />
        </SectionCard>

        {/* Relationship type */}
        <div className={styles.field}>
          <label className={styles.label}>Relationship Type</label>
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          {type === "custom" && (
            <input
              className={styles.input}
              placeholder="Enter relationship type…"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            />
          )}
        </div>

        {/* Visibility */}
        <div className={styles.field}>
          <label className={styles.label}>Visibility</label>
          <div className={styles.visibilityRow}>
            <button
              type="button"
              className={`${styles.visBtn} ${visibility === "public" ? styles.visBtnActive : ""}`}
              onClick={() => setVisibility("public")}
            >
              <Eye size={12} /> Public
            </button>
            <button
              type="button"
              className={`${styles.visBtn} ${visibility === "hidden" ? styles.visBtnActive : ""}`}
              onClick={() => setVisibility("hidden")}
            >
              <EyeOff size={12} /> Hidden
            </button>
            <span className={styles.visHint}>
              {visibility === "hidden"
                ? "Other characters don't know about this relationship."
                : "This relationship is known to others in the story world."}
            </span>
          </div>
        </div>

        {/* Strength */}
        <SectionCard title="Strength dimensions" collapsible>
          <StrengthSliders value={strength} onChange={setStrength} />
        </SectionCard>

        {/* Narrative purpose */}
        <div className={styles.field}>
          <label className={styles.label}>Narrative Purpose *</label>
          <NarrativePurposeTags value={purposes} onChange={setPurposes} error={purposeError} />
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label className={styles.label}>Brief Description</label>
          <input
            className={styles.input}
            placeholder="One-line summary of the relationship…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Notes — first-class */}
        <div className={styles.field}>
          <label className={styles.label}>Author Notes</label>
          <p className={styles.hint}>
            Nuance, subtext, or anything not captured above. Available for AI context.
          </p>
          <textarea
            className={styles.notes}
            placeholder="Write anything about this relationship here…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
          />
        </div>
      </div>

      {saveError && <p className={styles.saveError}>{saveError}</p>}
      <div className={styles.footer}>
        {!isNew &&
          (pendingDelete ? (
            <div className={styles.deleteConfirm}>
              <button className={styles.deleteConfirmYes} onClick={doDelete}>
                Delete
              </button>
              <button className={styles.deleteConfirmNo} onClick={() => setPendingDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className={styles.deleteBtn} onClick={() => setPendingDelete(true)}>
              Delete
            </button>
          ))}
        <button className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving || (isNew && !targetId)}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </aside>
  );
}
