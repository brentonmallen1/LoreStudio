import { useState, useMemo } from "react";
import { X, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { RelationshipSuggestion, Character, CharacterRelationship, StrengthDimensions } from "../../../types";
import { api } from "../../../api/client";
import { STRENGTH_DIMS } from "./StrengthSliders";
import styles from "./RelationshipSuggestionsModal.module.css";

// Which AI-suggested fields to accept when updating an existing relationship
interface FieldAccept {
  type: boolean;
  description: boolean;
  strength: boolean;
  narrative_purpose: boolean;
}

interface Row {
  suggestion: RelationshipSuggestion;
  existing: CharacterRelationship | null;
  // Row-level: include this suggestion in the save
  selected: boolean;
  // Field-level (only relevant when existing !== null)
  fieldAccept: FieldAccept;
  // Editable AI values — user can tweak before accepting
  editType: string;
  editDescription: string;
  editStrength: StrengthDimensions;
  editPurpose: string[];
  expanded: boolean;
}

interface Props {
  suggestions: RelationshipSuggestion[];
  characterId: string;
  characters: Character[];
  existingRelationships: CharacterRelationship[];
  onClose: () => void;
  onSaved: () => void;
}

function initials(n: string) {
  return n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function charName(id: string, chars: Character[]) {
  return chars.find((c) => c.id === id)?.name ?? "?";
}
function sign(stored: number) {
  const d = stored - 5;
  return `${d > 0 ? "+" : ""}${d}`;
}

function findExisting(s: RelationshipSuggestion, existing: CharacterRelationship[]): CharacterRelationship | null {
  const a = s.character_a_id, b = s.character_b_id;
  return existing.find(
    (r) => (r.character_id === a && r.related_character_id === b) ||
            (r.character_id === b && r.related_character_id === a)
  ) ?? null;
}

const ALL_ACCEPT: FieldAccept = { type: true, description: true, strength: true, narrative_purpose: true };

export default function RelationshipSuggestionsModal({
  suggestions, characterId, characters, existingRelationships, onClose, onSaved,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    suggestions.map((s) => {
      const existing = findExisting(s, existingRelationships);
      return {
        suggestion: s,
        existing,
        selected: true,
        fieldAccept: existing ? ALL_ACCEPT : ALL_ACCEPT,
        editType: s.relationship_type,
        editDescription: s.description,
        editStrength: {
          trust:     s.strength_trust     ?? 5,
          power:     s.strength_power     ?? 5,
          affection: s.strength_affection ?? 5,
          tension:   s.strength_tension   ?? 5,
          openness:  s.strength_openness  ?? 5,
        },
        editPurpose: s.narrative_purpose ?? [],
        expanded: existing !== null, // auto-expand when there's a comparison to show
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected   = rows.every((r) => r.selected);
  const noneSelected  = rows.every((r) => !r.selected);

  function patch(idx: number, p: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...p } : r));
  }
  function patchField(idx: number, field: keyof FieldAccept, val: boolean) {
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, fieldAccept: { ...r.fieldAccept, [field]: val } } : r
    ));
  }
  function patchStrength(idx: number, key: keyof StrengthDimensions, val: number) {
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, editStrength: { ...r.editStrength, [key]: val } } : r
    ));
  }
  function selectAll() { setRows((prev) => prev.map((r) => ({ ...r, selected: true }))); }
  function clearAll()  { setRows((prev) => prev.map((r) => ({ ...r, selected: false }))); }

  // Summary of what this row will actually write
  const effectiveFields = useMemo(() => rows.map((row) => {
    if (!row.existing) return { type: true, description: true, strength: true, narrative_purpose: true };
    return row.fieldAccept;
  }), [rows]);

  async function handleSave() {
    const toSave = rows.filter((r) => r.selected);
    if (toSave.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.selected) continue;
        const s  = row.suggestion;
        const idA = s.character_a_id, idB = s.character_b_id;
        if (!idA || !idB) continue;

        const fromId = idA === characterId ? idA : idB === characterId ? idB : idA;
        const toId   = fromId === idA ? idB : idA;
        const ef     = effectiveFields[i];

        if (row.existing) {
          // Build patch from only accepted fields
          const patch: Partial<CharacterRelationship> = {};
          if (ef.type)              patch.relationship_type = row.editType;
          if (ef.description)       patch.description       = row.editDescription;
          if (ef.strength)          patch.strength          = row.editStrength;
          if (ef.narrative_purpose) patch.narrative_purpose = row.editPurpose;
          if (Object.keys(patch).length > 0) {
            await api.updateRelationship(row.existing.id, patch);
          }
        } else {
          await api.createRelationship(fromId, {
            related_character_id: toId,
            relationship_type: row.editType,
            description: row.editDescription,
            strength: row.editStrength,
            narrative_purpose: row.editPurpose,
            visibility: "public",
            is_suggested: false,
            suggestion_source: "ai-profile",
            notes: s.rationale ? `AI rationale: ${s.rationale}` : "",
          });
        }
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to save some relationships. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Sparkles size={15} className={styles.headerIcon} />
            <span className={styles.title}>AI Relationship Suggestions</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Subtitle + select controls */}
        <div className={styles.controls}>
          <p className={styles.subtitle}>
            Review suggestions. Suggestions for existing relationships show current vs. AI values — check which fields to accept.
          </p>
          <div className={styles.selectControls}>
            <button className={styles.bulkBtn} onClick={selectAll} disabled={allSelected}>Select all</button>
            <span className={styles.bulkDivider}>·</span>
            <button className={styles.bulkBtn} onClick={clearAll} disabled={noneSelected}>Clear all</button>
          </div>
        </div>

        {/* Suggestion list */}
        <div className={styles.list}>
          {rows.length === 0 && <div className={styles.empty}>No suggestions returned. Try again.</div>}

          {rows.map((row, idx) => {
            const s    = row.suggestion;
            const ex   = row.existing;
            const aName = charName(s.character_a_id, characters) || s.character_a;
            const bName = charName(s.character_b_id, characters) || s.character_b;
            const exStrength = ex?.strength as unknown as Record<string, number> | null;

            return (
              <div key={idx} className={`${styles.card} ${row.selected ? styles.cardSelected : styles.cardDimmed}`}>

                {/* Row header: select + pair + update badge + expand */}
                <div className={styles.cardHeader}>
                  <button
                    className={`${styles.selectBtn} ${row.selected ? styles.selectBtnActive : ""}`}
                    onClick={() => patch(idx, { selected: !row.selected })}
                    title={row.selected ? "Deselect" : "Select"}
                  >
                    {row.selected && <Check size={11} />}
                  </button>

                  <div className={styles.pair}>
                    <span className={styles.avatar}>{initials(aName)}</span>
                    <span className={styles.pairName}>{aName}</span>
                    <span className={styles.pairArrow}>↔</span>
                    <span className={styles.pairName}>{bName}</span>
                    <span className={styles.avatar}>{initials(bName)}</span>
                  </div>

                  {ex && <span className={styles.updateBadge}>Updates existing</span>}

                  <button
                    className={styles.expandBtn}
                    onClick={() => patch(idx, { expanded: !row.expanded })}
                    title={row.expanded ? "Collapse" : "Expand"}
                  >
                    {row.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Collapsed preview */}
                {!row.expanded && (
                  <div className={styles.preview}>
                    <span className={styles.typeTag}>{row.editType}</span>
                    <span className={styles.descPreview}>{row.editDescription}</span>
                  </div>
                )}

                {/* Expanded: comparison + editable fields */}
                {row.expanded && (
                  <div className={styles.editForm}>

                    {/* AI rationale */}
                    {s.rationale && (
                      <p className={styles.rationaleBox}><em>Why:</em> {s.rationale}</p>
                    )}

                    {/* ── Relationship type ── */}
                    <div className={styles.fieldBlock}>
                      <div className={styles.fieldBlockHeader}>
                        <label className={styles.fieldLabel}>Relationship type</label>
                        {ex && (
                          <label className={styles.acceptToggle}>
                            <input type="checkbox" checked={row.fieldAccept.type}
                              onChange={(e) => patchField(idx, "type", e.target.checked)} />
                            Accept
                          </label>
                        )}
                      </div>
                      {ex && (
                        <div className={styles.compareRow}>
                          <div className={styles.currentVal}>
                            <span className={styles.currentLabel}>Current</span>
                            <span className={styles.typeTag}>{ex.relationship_type}</span>
                          </div>
                          <span className={styles.compareArrow}>→</span>
                          <div className={styles.suggestedVal}>
                            <span className={styles.suggestedLabel}>AI suggests</span>
                            <input
                              className={`${styles.fieldInput} ${!row.fieldAccept.type ? styles.fieldInputDimmed : ""}`}
                              value={row.editType}
                              disabled={!row.fieldAccept.type}
                              onChange={(e) => patch(idx, { editType: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                      {!ex && (
                        <input className={styles.fieldInput} value={row.editType}
                          onChange={(e) => patch(idx, { editType: e.target.value })} />
                      )}
                    </div>

                    {/* ── Description ── */}
                    <div className={styles.fieldBlock}>
                      <div className={styles.fieldBlockHeader}>
                        <label className={styles.fieldLabel}>Description</label>
                        {ex && (
                          <label className={styles.acceptToggle}>
                            <input type="checkbox" checked={row.fieldAccept.description}
                              onChange={(e) => patchField(idx, "description", e.target.checked)} />
                            Accept
                          </label>
                        )}
                      </div>
                      {ex && ex.description && (
                        <p className={styles.currentText}><span className={styles.currentLabel}>Current:</span> {ex.description}</p>
                      )}
                      <textarea
                        className={`${styles.fieldTextarea} ${ex && !row.fieldAccept.description ? styles.fieldInputDimmed : ""}`}
                        rows={3}
                        value={row.editDescription}
                        disabled={ex ? !row.fieldAccept.description : false}
                        onChange={(e) => patch(idx, { editDescription: e.target.value })}
                      />
                    </div>

                    {/* ── Narrative purpose ── */}
                    {(row.editPurpose.length > 0 || (ex?.narrative_purpose?.length ?? 0) > 0) && (
                      <div className={styles.fieldBlock}>
                        <div className={styles.fieldBlockHeader}>
                          <label className={styles.fieldLabel}>Narrative purpose</label>
                          {ex && (
                            <label className={styles.acceptToggle}>
                              <input type="checkbox" checked={row.fieldAccept.narrative_purpose}
                                onChange={(e) => patchField(idx, "narrative_purpose", e.target.checked)} />
                              Accept
                            </label>
                          )}
                        </div>
                        {ex && (ex.narrative_purpose?.length ?? 0) > 0 && (
                          <div className={styles.purposes}>
                            <span className={styles.currentLabel}>Current:</span>
                            {ex.narrative_purpose.map((p) => <span key={p} className={styles.purposeChip}>{p}</span>)}
                          </div>
                        )}
                        <div className={`${styles.purposes} ${ex && !row.fieldAccept.narrative_purpose ? styles.dimmed : ""}`}>
                          {ex && <span className={styles.suggestedLabel}>AI suggests:</span>}
                          {row.editPurpose.map((p) => <span key={p} className={styles.purposeChipAi}>{p}</span>)}
                        </div>
                      </div>
                    )}

                    {/* ── Strength dimensions ── */}
                    <div className={styles.fieldBlock}>
                      <div className={styles.fieldBlockHeader}>
                        <label className={styles.fieldLabel}>Strength dimensions</label>
                        {ex && (
                          <label className={styles.acceptToggle}>
                            <input type="checkbox" checked={row.fieldAccept.strength}
                              onChange={(e) => patchField(idx, "strength", e.target.checked)} />
                            Accept all
                          </label>
                        )}
                      </div>
                      <div className={styles.sliders}>
                        {STRENGTH_DIMS.map((dim) => {
                          const aiStored   = row.editStrength[dim.key];
                          const currStored = exStrength?.[dim.key] ?? 5;
                          const aiDisplay  = aiStored - 5;
                          const disabled   = ex ? !row.fieldAccept.strength : false;
                          return (
                            <div key={dim.key} className={styles.sliderRow}>
                              <span className={styles.sliderLabel}>{dim.label}</span>
                              {ex && (
                                <span className={styles.currentMini} title="Current value">
                                  {sign(currStored)}
                                </span>
                              )}
                              <span className={styles.sliderNeg}>{dim.negLabel}</span>
                              <input
                                type="range" min={0} max={10} step={1}
                                value={aiStored}
                                disabled={disabled}
                                className={`${styles.sliderInput} ${disabled ? styles.sliderDimmed : ""}`}
                                style={{ accentColor: dim.color }}
                                onChange={(e) => patchStrength(idx, dim.key, Number(e.target.value))}
                              />
                              <span className={styles.sliderPos}>{dim.posLabel}</span>
                              <span
                                className={styles.sliderVal}
                                style={{ color: aiDisplay < 0 ? "#a06090" : aiDisplay > 0 ? "#609878" : "var(--color-text-subtle)" }}
                              >
                                {aiDisplay > 0 ? "+" : ""}{aiDisplay}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
          >
            {saving ? "Saving…" : `Save ${selectedCount} relationship${selectedCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
