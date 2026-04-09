import { useState, FormEvent } from "react";
import { UserRound, Plus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import { Modal, SectionCard } from "../common";
import styles from "./CharacterFormDialog.module.css";

interface Props {
  storyId: string;
  character?: Character;
  onClose: () => void;
  onSaved?: (character: Character) => void;
}

const ROLES = ["protagonist", "antagonist", "supporting", "minor"];

export default function CharacterFormDialog({ storyId, character, onClose, onSaved }: Props) {
  const { upsertCharacter } = useStoryStore();
  const isEditing = !!character;

  const [name, setName] = useState(character?.name ?? "");
  const [role, setRole] = useState(character?.role ?? "supporting");
  const [missionStatement, setMissionStatement] = useState(character?.mission_statement ?? "");
  const [personality, setPersonality] = useState(character?.personality ?? "");
  const [motivation, setMotivation] = useState(character?.motivation ?? "");
  const [background, setBackground] = useState(character?.background ?? "");
  const [appearance, setAppearance] = useState(character?.appearance ?? "");
  const [arcNotes, setArcNotes] = useState(character?.arc_notes ?? "");
  const [interviewPrompts, setInterviewPrompts] = useState<string[]>(
    character?.interview_prompts ?? [""]
  );
  const [loading, setLoading] = useState(false);

  function updatePrompt(i: number, value: string) {
    setInterviewPrompts((prev) => prev.map((p, idx) => (idx === i ? value : p)));
  }

  function addPrompt() {
    setInterviewPrompts((prev) => [...prev, ""]);
  }

  function removePrompt(i: number) {
    setInterviewPrompts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const data = {
      name: name.trim(),
      role,
      mission_statement: missionStatement,
      personality,
      motivation,
      background,
      appearance,
      arc_notes: arcNotes,
      interview_prompts: interviewPrompts.filter((p) => p.trim()),
    };
    try {
      const saved = isEditing
        ? await api.updateCharacter(character!.id, data)
        : await api.createCharacter(storyId, data);
      upsertCharacter(saved);
      onSaved?.(saved);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function TextField({
    label,
    value,
    onChange,
    rows = 1,
    hint,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
    hint?: string;
  }) {
    return (
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        {hint && <p className={styles.hint}>{hint}</p>}
        {rows === 1 ? (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={styles.input}
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className={styles.textarea}
          />
        )}
      </div>
    );
  }

  const footer = (
    <>
      <button type="button" onClick={onClose} className={styles.cancelBtn}>
        Cancel
      </button>
      <button
        type="submit"
        form="character-form"
        disabled={loading || !name.trim()}
        className={styles.submitBtn}
      >
        {loading ? "Saving…" : isEditing ? "Save changes" : "Add character"}
      </button>
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit ${character!.name}` : "New Character"}
      icon={<UserRound size={15} />}
      size="lg"
      footer={footer}
    >
      <form id="character-form" onSubmit={handleSubmit} className={styles.formBody}>

        {/* ── Basics ── */}
        <SectionCard title="Basics" collapsible={false}>
          <div className={styles.grid2}>
            <TextField label="Name *" value={name} onChange={setName} />
            <div className={styles.field}>
              <label className={styles.label}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={styles.select}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        {/* ── Character Depth ── */}
        <SectionCard title="Character Depth">
          <TextField
            label="Mission Statement"
            value={missionStatement}
            onChange={setMissionStatement}
            rows={1}
            hint="One sentence: what does this character fundamentally want or need?"
          />
          <TextField
            label="Personality"
            value={personality}
            onChange={setPersonality}
            rows={2}
            hint="Key traits that define how they think and behave"
          />
          <TextField
            label="Motivation"
            value={motivation}
            onChange={setMotivation}
            rows={2}
            hint="What drives them — their core need or goal"
          />
          <TextField
            label="Background"
            value={background}
            onChange={setBackground}
            rows={3}
            hint="History, upbringing, formative experiences"
          />
        </SectionCard>

        {/* ── Presentation & Arc ── */}
        <SectionCard title="Presentation & Arc">
          <TextField label="Appearance" value={appearance} onChange={setAppearance} rows={2} />
          <TextField
            label="Arc Notes"
            value={arcNotes}
            onChange={setArcNotes}
            rows={2}
            hint="How do they change throughout the story?"
          />
        </SectionCard>

        {/* ── Interview Setup ── */}
        <SectionCard title="Interview Setup" variant="ai">
          <p className={styles.sectionHint}>Suggested questions to ask when you interview this character</p>
          <div className={styles.promptList}>
            {interviewPrompts.map((prompt, i) => (
              <div key={i} className={styles.promptRow}>
                <input
                  value={prompt}
                  onChange={(e) => updatePrompt(i, e.target.value)}
                  placeholder={`e.g. "What do you fear most?"`}
                  className={styles.promptInput}
                />
                <button
                  type="button"
                  onClick={() => removePrompt(i)}
                  className={styles.removePromptBtn}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addPrompt} className={styles.addPromptBtn}>
            <Plus size={12} /> Add prompt
          </button>
        </SectionCard>

      </form>
    </Modal>
  );
}
