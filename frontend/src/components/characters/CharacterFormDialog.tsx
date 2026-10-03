import { useState, FormEvent } from "react";
import { UserRound, Plus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import { Modal, SectionCard } from "../common";
import RenamePreviewDialog from "./RenamePreviewDialog";
import PronounRefactorDialog from "./PronounRefactorDialog";
import styles from "./CharacterFormDialog.module.css";

interface Props {
  storyId: string;
  character?: Character;
  onClose: () => void;
  onSaved?: (character: Character) => void;
}

interface ClassificationOption {
  value: string;
  label: string;
  description: string;
  sub?: string; // e.g. "Strengths: …" or "Weaknesses: …"
}

const ROLES: ClassificationOption[] = [
  {
    value: "protagonist",
    label: "Protagonist",
    description: "Main character: the narrative follows their choices and growth.",
  },
  {
    value: "deuteragonist",
    label: "Deuteragonist",
    description: "Secondary lead: a close companion or ally whose path intertwines with the protagonist's.",
    sub: "e.g. Ron Weasley, Samwise Gamgee",
  },
  {
    value: "antagonist",
    label: "Antagonist",
    description: "Opposes the protagonist through villainy, rivalry, or conflicting values.",
  },
  {
    value: "love_interest",
    label: "Love interest",
    description:
      "A character whose romantic or emotional connection to the protagonist adds stakes and complexity.",
  },
  {
    value: "confidant",
    label: "Confidant",
    description: "The character the protagonist trusts with their doubts and fears; they carry secrets.",
  },
  {
    value: "foil",
    label: "Foil",
    description: "Contrasts the protagonist's qualities to highlight them: the cautious to their bold.",
  },
  {
    value: "tertiary",
    label: "Tertiary",
    description: "Background character who populates the world: real, but not central to the main plot.",
  },
];

const CHARACTER_TYPES: ClassificationOption[] = [
  {
    value: "round",
    label: "Round",
    description: "Complex and multi-dimensional: contradictory, capable of surprising even themselves.",
  },
  {
    value: "flat",
    label: "Flat",
    description: "Defined by one or two clear traits: reliable and consistent, but not deeply layered.",
  },
  {
    value: "dynamic",
    label: "Dynamic",
    description: "Changes or grows throughout the story; the arc is built into who they are.",
  },
  {
    value: "static",
    label: "Static",
    description: "Fundamentally unchanged: a fixed point that can be an anchor or a limitation.",
  },
  {
    value: "stock",
    label: "Stock",
    description: "A recognizable type (the wise elder, the loyal friend), shaped by convention.",
  },
  {
    value: "symbolic",
    label: "Symbolic",
    description: "Represents something larger (an idea, a theme, a force), more than a realistic individual.",
  },
];

const JUNGIAN_ARCHETYPES: ClassificationOption[] = [
  {
    value: "lover",
    label: "Lover",
    description: "Guided by the heart: passionate, humane, and connected.",
    sub: "Strengths: humanism, passion · Weaknesses: naivety, irrationality",
  },
  {
    value: "hero",
    label: "Hero",
    description: "Rises to meet challenges with courage and perseverance.",
    sub: "Strengths: courage, honor · Weaknesses: overconfidence, hubris",
  },
  {
    value: "magician",
    label: "Magician",
    description: "Masters the underlying forces: knowledge as power.",
    sub: "Strengths: omniscience, discipline · Weaknesses: corruptibility, arrogance",
  },
  {
    value: "outlaw",
    label: "Outlaw",
    description: "Defies convention: independent, skeptical, willing to break rules.",
    sub: "Strengths: independence, skepticism · Weaknesses: self-involvement, criminality",
  },
  {
    value: "explorer",
    label: "Explorer",
    description: "Driven to discover: restless, curious, always seeking what's next.",
    sub: "Strengths: curiosity, self-improvement · Weaknesses: restlessness, never settled",
  },
  {
    value: "sage",
    label: "Sage",
    description: "Guided by wisdom and long experience: insightful but cautious.",
    sub: "Strengths: wisdom, insight · Weaknesses: hesitant to act, overly cautious",
  },
  {
    value: "innocent",
    label: "Innocent",
    description: "Morally pure: sincerely good, but vulnerable and naive.",
    sub: "Strengths: kindness, sincerity · Weaknesses: vulnerability, lack of skill",
  },
  {
    value: "creator",
    label: "Creator",
    description: "A driven visionary: builds things, holds a strong conviction.",
    sub: "Strengths: creativity, willpower · Weaknesses: self-involved, single-minded",
  },
  {
    value: "ruler",
    label: "Ruler",
    description: "Carries authority: natural command, status, and resources.",
    sub: "Strengths: power, status · Weaknesses: aloof, perceived as out of touch",
  },
  {
    value: "caregiver",
    label: "Caregiver",
    description: "Lives in service to others: selfless, loyal, and reliable.",
    sub: "Strengths: selflessness, loyalty · Weaknesses: lacks ambition, may lack self-worth",
  },
  {
    value: "everyman",
    label: "Everyman",
    description: "Grounded and relatable: no special powers, just ordinary humanity.",
    sub: "Strengths: relatable, grounded · Weaknesses: unprepared for the extraordinary",
  },
  {
    value: "jester",
    label: "Jester",
    description: "Finds truth through humor: disarming, funny, and often perceptive.",
    sub: "Strengths: insight, disarming · Weaknesses: obnoxious, avoids real feeling",
  },
];

const NARRATIVE_ARCHETYPES: ClassificationOption[] = [
  {
    value: "hero",
    label: "Hero",
    description: "Central figure on a transformative journey; the story follows their arc.",
  },
  {
    value: "mentor",
    label: "Mentor",
    description: "Wise guide who prepares the hero with knowledge, challenge, or example.",
  },
  {
    value: "threshold_guardian",
    label: "Threshold guardian",
    description: "Tests the hero before they can progress. Ensures only the ready pass.",
  },
  {
    value: "herald",
    label: "Herald",
    description: "Announces that change is coming; their arrival sets the story in motion.",
  },
  {
    value: "shapeshifter",
    label: "Shapeshifter",
    description: "Uncertain loyalty: keeps the hero and reader guessing about their allegiance.",
  },
  {
    value: "shadow",
    label: "Shadow",
    description: "Dark mirror: represents what the hero fears becoming; the antagonist.",
  },
  {
    value: "trickster",
    label: "Trickster",
    description: "Disrupts through humor or chaos. Often reveals uncomfortable truths.",
  },
  {
    value: "ally",
    label: "Ally",
    description: "Walks alongside the hero: loyal, capable, essential to the journey.",
  },
];

const PRONOUN_PRESETS = ["he/him", "she/her", "they/them"];

export default function CharacterFormDialog({ storyId, character, onClose, onSaved }: Props) {
  const { upsertCharacter } = useStoryStore();
  const isEditing = !!character;

  const initialPronouns = character?.pronouns ?? "";
  const initialPronounSelect = PRONOUN_PRESETS.includes(initialPronouns)
    ? initialPronouns
    : initialPronouns
      ? "custom"
      : "";

  const [name, setName] = useState(character?.name ?? "");
  const [role, setRole] = useState(character?.role ?? "deuteragonist");
  const [characterType, setCharacterType] = useState(character?.character_type ?? "");
  const [jungianArchetype, setJungianArchetype] = useState(character?.jungian_archetype ?? "");
  const [narrativeArchetype, setNarrativeArchetype] = useState(character?.narrative_archetype ?? "");
  const [pronounSelect, setPronounSelect] = useState(initialPronounSelect);
  const [pronounCustom, setPronounCustom] = useState(
    initialPronounSelect === "custom" ? initialPronouns : "",
  );
  const [missionStatement, setMissionStatement] = useState(character?.mission_statement ?? "");
  const [personality, setPersonality] = useState(character?.personality ?? "");
  const [motivation, setMotivation] = useState(character?.motivation ?? "");
  const [background, setBackground] = useState(character?.background ?? "");
  const [appearance, setAppearance] = useState(character?.appearance ?? "");
  const [arcNotes, setArcNotes] = useState(character?.arc_notes ?? "");
  const [interviewPrompts, setInterviewPrompts] = useState<string[]>(character?.interview_prompts ?? [""]);
  const [loading, setLoading] = useState(false);

  // Post-save dialogs
  const [renameState, setRenameState] = useState<{
    preview: import("../../types").RenamePreviewResponse;
    pendingSaved: Character;
  } | null>(null);
  const [pronounRefactorState, setPronounRefactorState] = useState<{
    characterId: string;
    newPronouns: string;
    oldPronouns: string;
    saved: Character;
  } | null>(null);

  const effectivePronouns = pronounSelect === "custom" ? pronounCustom : pronounSelect;

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
          effectivePronouns !== (character!.pronouns ?? "") &&
          effectivePronouns.trim() !== "" &&
          (character!.pronouns ?? "").trim() !== "";

        if (nameChanged) {
          // Preview rename before saving name
          const preview = await api.previewCharacterRename(character!.id, name.trim());
          if (preview.affected_scenes.length > 0) {
            // Save character first (without name change to avoid confusion), then show rename dialog
            const saved = await api.updateCharacter(character!.id, { ...data, name: character!.name });
            upsertCharacter(saved);
            setRenameState({
              preview: { ...preview, old_name: character!.name, new_name: name.trim() },
              pendingSaved: saved,
            });
            return;
          }
        }

        const saved = await api.updateCharacter(character!.id, data);
        upsertCharacter(saved);

        if (pronounsChanged) {
          setPronounRefactorState({
            characterId: saved.id,
            newPronouns: effectivePronouns,
            oldPronouns: character!.pronouns ?? "",
            saved,
          });
          return;
        }

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

  // Rename preview dialog: user selects which scenes to propagate rename to
  if (renameState) {
    return (
      <RenamePreviewDialog
        preview={renameState.preview}
        onApplied={(saved) => {
          upsertCharacter(saved);
          onSaved?.(saved);
          onClose();
        }}
        onSkip={() => {
          onSaved?.(renameState.pendingSaved);
          onClose();
        }}
        characterId={character!.id}
      />
    );
  }

  // Pronoun refactor dialog: offer AI-assisted rewriting
  if (pronounRefactorState) {
    return (
      <PronounRefactorDialog
        characterId={pronounRefactorState.characterId}
        oldPronouns={pronounRefactorState.oldPronouns}
        newPronouns={pronounRefactorState.newPronouns}
        saved={pronounRefactorState.saved}
        onDone={(saved) => {
          upsertCharacter(saved);
          onSaved?.(saved);
          onClose();
        }}
        onSkip={() => {
          onSaved?.(pronounRefactorState.saved);
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
              <label className={styles.label}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={styles.select}>
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
              <label className={styles.label}>Character type</label>
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
          <div className={styles.field}>
            <label className={styles.label}>Pronouns</label>
            <div className={styles.pronounsRow}>
              <select
                value={pronounSelect}
                onChange={(e) => {
                  setPronounSelect(e.target.value);
                  if (e.target.value !== "custom") setPronounCustom("");
                }}
                className={styles.select}
              >
                <option value="">Not specified</option>
                {PRONOUN_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {pronounSelect === "custom" && (
                <input
                  value={pronounCustom}
                  onChange={(e) => setPronounCustom(e.target.value)}
                  placeholder="e.g. xe/xem"
                  className={styles.input}
                />
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── Archetypes ── */}
        <SectionCard title="Archetypes">
          <p className={styles.sectionHint}>
            Optional classifications that inform how the AI portrays this character in interviews and panels.
          </p>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Jungian archetype</label>
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
