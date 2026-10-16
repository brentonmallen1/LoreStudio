import { useState, FormEvent } from "react";
import { UserRound, Plus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import { Modal, SectionCard } from "../common";
import ManuscriptReview, { type ReviewChange } from "./ManuscriptReview";
import PronounsAndGender from "./PronounsAndGender";
import Term from "../common/Term";
import {
  CHARACTER_TYPES,
  JUNGIAN_ARCHETYPES,
  NARRATIVE_ARCHETYPES,
  ROLES,
} from "../../lib/characters/classifications";
import styles from "./CharacterFormDialog.module.css";

interface Props {
  storyId: string;
  character?: Character;
  onClose: () => void;
  onSaved?: (character: Character) => void;
}

export default function CharacterFormDialog({ storyId, character, onClose, onSaved }: Props) {
  const { upsertCharacter } = useStoryStore();
  const isEditing = !!character;

  const [name, setName] = useState(character?.name ?? "");
  const [role, setRole] = useState(character?.role ?? "");
  const [characterType, setCharacterType] = useState(character?.character_type ?? "");
  const [jungianArchetype, setJungianArchetype] = useState(character?.jungian_archetype ?? "");
  const [narrativeArchetype, setNarrativeArchetype] = useState(character?.narrative_archetype ?? "");
  const [effectivePronouns, setPronouns] = useState(character?.pronouns ?? "");
  const [gender, setGender] = useState(character?.gender ?? "");
  const [missionStatement, setMissionStatement] = useState(character?.mission_statement ?? "");
  const [personality, setPersonality] = useState(character?.personality ?? "");
  const [motivation, setMotivation] = useState(character?.motivation ?? "");
  const [background, setBackground] = useState(character?.background ?? "");
  const [appearance, setAppearance] = useState(character?.appearance ?? "");
  const [arcNotes, setArcNotes] = useState(character?.arc_notes ?? "");
  const [interviewPrompts, setInterviewPrompts] = useState<string[]>(character?.interview_prompts ?? [""]);
  const [loading, setLoading] = useState(false);

  // After a save that changed the name or pronouns: the manuscript, sentence by sentence.
  const [reviewing, setReviewing] = useState<{ saved: Character; change: ReviewChange } | null>(null);

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
      character_type: characterType,
      jungian_archetype: jungianArchetype,
      narrative_archetype: narrativeArchetype,
      pronouns: effectivePronouns,
      gender,
      mission_statement: missionStatement,
      personality,
      motivation,
      background,
      appearance,
      arc_notes: arcNotes,
      interview_prompts: interviewPrompts.filter((p) => p.trim()),
    };
    try {
      if (isEditing) {
        const nameChanged = name.trim() !== character!.name;
        const pronounsChanged =
          effectivePronouns !== (character!.pronouns ?? "") && (character!.pronouns ?? "").trim() !== "";
        // A new name or pronouns go through the review (doc 20 P3): the rest saves now, and the
        // review's Apply (or Skip) changes them with the sentences that follow, as one Undo.
        if (nameChanged || pronounsChanged) {
          const saved = await api.updateCharacter(character!.id, {
            ...data,
            name: character!.name,
            pronouns: character!.pronouns ?? "",
          });
          upsertCharacter(saved);
          setReviewing({
            saved,
            change: {
              ...(pronounsChanged && {
                pronouns: [character!.pronouns ?? "", effectivePronouns] as [string, string],
              }),
              ...(nameChanged && { name: [character!.name, name.trim()] as [string, string] }),
            },
          });
          return;
        }

        const saved = await api.updateCharacter(character!.id, data);
        upsertCharacter(saved);
        onSaved?.(saved);
        onClose();
      } else {
        const saved = await api.createCharacter(storyId, data);
        upsertCharacter(saved);
        onSaved?.(saved);
        onClose();
      }
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
          <input value={value} onChange={(e) => onChange(e.target.value)} className={styles.input} />
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

  if (reviewing) {
    return (
      <ManuscriptReview
        character={reviewing.saved}
        storyId={storyId}
        change={reviewing.change}
        onDone={(saved) => {
          upsertCharacter(saved);
          onSaved?.(saved);
          onClose();
        }}
        onClose={() => {
          onSaved?.(reviewing.saved);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit ${character!.name}` : "New character"}
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
              <label className={styles.label}>
                <Term id="character-role">Role</Term>
              </label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={styles.select}>
                <option value="">No role yet</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {(() => {
                const selected = ROLES.find((r) => r.value === role);
                return selected ? (
                  <p className={styles.classificationHint}>
                    {selected.description}
                    {selected.sub ? (
                      <>
                        <br />
                        <span className={styles.classificationSub}>{selected.sub}</span>
                      </>
                    ) : null}
                  </p>
                ) : null;
              })()}
            </div>
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>
                <Term id="character-type">Character type</Term>
              </label>
              <select
                value={characterType}
                onChange={(e) => setCharacterType(e.target.value)}
                className={styles.select}
              >
                <option value="">Not specified</option>
                {CHARACTER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {characterType &&
                (() => {
                  const selected = CHARACTER_TYPES.find((t) => t.value === characterType);
                  return selected ? (
                    <p className={styles.classificationHint}>{selected.description}</p>
                  ) : null;
                })()}
            </div>
          </div>
          <PronounsAndGender
            pronouns={effectivePronouns}
            gender={gender}
            onPronouns={setPronouns}
            onGender={setGender}
          />
        </SectionCard>

        {/* ── Archetypes ── */}
        <SectionCard title="Archetypes">
          <p className={styles.sectionHint}>
            Optional lenses on who this character is. Leave any of them empty.
          </p>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>
                Jungian <Term id="archetype">archetype</Term>
              </label>
              <p className={styles.hint}>Core identity, from Carl Jung's 12 personality archetypes</p>
              <select
                value={jungianArchetype}
                onChange={(e) => setJungianArchetype(e.target.value)}
                className={styles.select}
              >
                <option value="">None</option>
                {JUNGIAN_ARCHETYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              {jungianArchetype &&
                (() => {
                  const selected = JUNGIAN_ARCHETYPES.find((a) => a.value === jungianArchetype);
                  return selected ? (
                    <p className={styles.classificationHint}>
                      {selected.description}
                      {selected.sub ? (
                        <>
                          <br />
                          <span className={styles.classificationSub}>{selected.sub}</span>
                        </>
                      ) : null}
                    </p>
                  ) : null;
                })()}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Narrative archetype</label>
              <p className={styles.hint}>Story function, from the Hero's Journey framework</p>
              <select
                value={narrativeArchetype}
                onChange={(e) => setNarrativeArchetype(e.target.value)}
                className={styles.select}
              >
                <option value="">None</option>
                {NARRATIVE_ARCHETYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              {narrativeArchetype &&
                (() => {
                  const selected = NARRATIVE_ARCHETYPES.find((a) => a.value === narrativeArchetype);
                  return selected ? (
                    <p className={styles.classificationHint}>{selected.description}</p>
                  ) : null;
                })()}
            </div>
          </div>
        </SectionCard>

        {/* ── Character Depth ── */}
        <SectionCard title="Character depth">
          <TextField
            label="Goal"
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
            hint="What drives them: their core need or goal"
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
        <SectionCard title="Presentation & arc">
          <TextField label="Appearance" value={appearance} onChange={setAppearance} rows={2} />
          <TextField
            label="Arc notes"
            value={arcNotes}
            onChange={setArcNotes}
            rows={2}
            hint="How do they change throughout the story?"
          />
        </SectionCard>

        {/* ── Interview Setup ── */}
        <SectionCard title="Interview setup" variant="ai">
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
                  aria-label="Remove this prompt"
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
