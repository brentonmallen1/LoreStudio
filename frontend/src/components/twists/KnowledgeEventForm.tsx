import { useState } from "react";
import { Check, X } from "lucide-react";
import { KNOWLEDGE_TYPES, KNOWLEDGE_TYPE_META, type KnowledgeDraft } from "../../lib/twists/knowledge";
import type { Character, KnowledgeType, StructureNode, Twist } from "../../types";
import styles from "./ReaderKnowledgeTimeline.module.css";

/**
 * Add or edit what the reader knows (doc 18): who knows is picked from the cast (ids, which
 * interviews and the Codex read; typed names reached neither), and an event can say which twist
 * it serves.
 */
export default function KnowledgeEventForm({
  initial,
  nodes,
  characters,
  twists,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial: KnowledgeDraft;
  nodes: StructureNode[];
  characters: Character[];
  twists: Twist[];
  saveLabel: string;
  onSave: (draft: KnowledgeDraft) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<KnowledgeDraft>(initial);
  const set = (patch: Partial<KnowledgeDraft>) => setForm((f) => ({ ...f, ...patch }));
  const toggleWho = (id: string) =>
    set({
      characters_who_know: form.characters_who_know.includes(id)
        ? form.characters_who_know.filter((c) => c !== id)
        : [...form.characters_who_know, id],
    });

  return (
    <div className={styles.addForm}>
      <div className={styles.addFormRow}>
        <input
          autoFocus
          aria-label="What the reader knows"
          className={styles.addInput}
          value={form.subject}
          onChange={(e) => set({ subject: e.target.value })}
          placeholder='What, in a few words ("The Visitor knew Thomas")'
        />
        <button type="button" aria-label="Cancel" className={styles.formCloseBtn} onClick={onCancel}>
          <X size={13} />
        </button>
      </div>
      <textarea
        aria-label="Detail"
        className={styles.addTextarea}
        value={form.detail}
        onChange={(e) => set({ detail: e.target.value })}
        placeholder="Detail (optional)"
        rows={2}
      />
      <div className={styles.addFormMeta}>
        <select
          aria-label="What kind"
          className={styles.addSelect}
          value={form.knowledge_type}
          title={KNOWLEDGE_TYPE_META[form.knowledge_type].hint}
          onChange={(e) => set({ knowledge_type: e.target.value as KnowledgeType })}
        >
          {KNOWLEDGE_TYPES.map((kt) => (
            <option key={kt} value={kt}>
              {KNOWLEDGE_TYPE_META[kt].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Scene"
          className={styles.addSelect}
          value={form.node_id ?? ""}
          onChange={(e) => set({ node_id: e.target.value || null })}
        >
          <option value="">No scene</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {"  ".repeat(n.level)}
              {n.title || `Untitled ${n.level_type}`}
            </option>
          ))}
        </select>
        {twists.length > 0 && (
          <select
            aria-label="Twist"
            className={styles.addSelect}
            value={form.twist_id ?? ""}
            onChange={(e) => set({ twist_id: e.target.value || null })}
          >
            <option value="">No twist</option>
            {twists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className={styles.addFormMeta}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.reader_knows}
            onChange={(e) => set({ reader_knows: e.target.checked })}
          />
          The reader knows it here
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.is_truth}
            onChange={(e) => set({ is_truth: e.target.checked })}
          />
          It is true (not a misdirection)
        </label>
      </div>
      {characters.length > 0 && (
        <div className={styles.whoKnows} role="group" aria-label="Characters who know">
          <span className={styles.whoKnowsLabel}>Who knows</span>
          {characters.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={form.characters_who_know.includes(c.id)}
              className={`${styles.whoChip} ${form.characters_who_know.includes(c.id) ? styles.whoChipOn : ""}`}
              onClick={() => toggleWho(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.addFormActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => onSave({ ...form, subject: form.subject.trim() })}
          disabled={!form.subject.trim()}
        >
          <Check size={12} /> {saveLabel}
        </button>
      </div>
    </div>
  );
}
