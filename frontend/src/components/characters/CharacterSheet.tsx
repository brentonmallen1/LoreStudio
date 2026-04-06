import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Edit2, MessageSquare, ChevronRight, Plus, Trash2, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useAIStore } from "../../stores/aiStore";
import type { CharacterAttributes } from "../../types";

const ATTRIBUTE_DEFS: { key: keyof CharacterAttributes; label: string; options: string[] }[] = [
  { key: "intelligence",    label: "Intelligence",    options: ["Brilliant", "Sharp", "Average", "Simple", "Slow"] },
  { key: "education",       label: "Education",       options: ["Scholarly", "Educated", "Common", "Unlettered"] },
  { key: "moral_alignment", label: "Moral Alignment", options: ["Righteous", "Principled", "Pragmatic", "Self-Serving", "Corrupt"] },
  { key: "disposition",     label: "Disposition",     options: ["Orderly", "Conventional", "Flexible", "Unpredictable", "Chaotic"] },
  { key: "temperament",     label: "Temperament",     options: ["Serene", "Calm", "Balanced", "Volatile", "Explosive"] },
  { key: "social_manner",   label: "Social Manner",   options: ["Refined", "Polished", "Casual", "Rough", "Crude"] },
];
import CharacterFormDialog from "./CharacterFormDialog";
import AttributeGeneratorPanel from "./AttributeGeneratorPanel";
import StartInterviewDialog from "./StartInterviewDialog";
import AssetPicker from "../media/AssetPicker";
import styles from "./CharacterSheet.module.css";

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className={styles.field}>
      <p className={styles.fieldLabel}>{label}</p>
      <p className={styles.fieldValue}>{value}</p>
    </div>
  );
}

export default function CharacterSheet() {
  const { characterId, storyId } = useParams<{ characterId: string; storyId: string }>();
  const { characters, upsertCharacter } = useStoryStore();
  const { resumeSession } = useAIStore();
  const [editing, setEditing] = useState(false);
  const [showStartInterview, setShowStartInterview] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const intentSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const character = characters.find((c) => c.id === characterId);

  useEffect(() => {
    if (!characterId || character) return;
    api.getCharacter(characterId).then(upsertCharacter).catch(console.error);
  }, [characterId]);

  useEffect(() => {
    if (character) setIntentText(character.narrative_intent ?? "");
  }, [character?.id]);

  function scheduleIntentSave(text: string) {
    if (intentSaveRef.current) clearTimeout(intentSaveRef.current);
    intentSaveRef.current = setTimeout(async () => {
      if (!character) return;
      const updated = await api.updateCharacter(character.id, { narrative_intent: text });
      upsertCharacter(updated);
    }, 900);
  }

  async function toggleIntentHidden() {
    if (!character) return;
    const updated = await api.updateCharacter(character.id, { narrative_intent_hidden: !character.narrative_intent_hidden });
    upsertCharacter(updated);
  }

  async function addMilestone() {
    const text = newMilestone.trim();
    if (!text || !character) return;
    const updated = await api.addMilestone(character.id, text);
    upsertCharacter(updated);
    setNewMilestone("");
  }

  async function toggleMilestone(milestoneId: string, completed: boolean) {
    if (!character) return;
    const m = character.arc_milestones.find((x) => x.id === milestoneId);
    if (!m) return;
    const updated = await api.updateMilestone(character.id, milestoneId, { text: m.text, completed: !completed });
    upsertCharacter(updated);
  }

  async function removeMilestone(milestoneId: string) {
    if (!character) return;
    const updated = await api.deleteMilestone(character.id, milestoneId);
    upsertCharacter(updated);
  }

  async function updateAttribute(key: keyof CharacterAttributes, value: string) {
    if (!character) return;
    const updated = await api.updateCharacter(character.id, {
      attributes: { ...character.attributes, [key]: value },
    });
    upsertCharacter(updated);
  }

  async function handleInterviewStarted(interview: import("../../types").Interview) {
    if (!character) return;
    setShowStartInterview(false);
    await resumeSession(
      "interview",
      { characterId: character.id, storyId: storyId ?? character.story_id, nodeId: interview.context_node_id ?? undefined },
      interview.id,
      (interview.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      interview.interview_notes ?? undefined,
    );
  }

  if (!character) {
    return (
      <div className={styles.loading}>Loading…</div>
    );
  }

  function roleBadgeClass() {
    if (character!.role === "protagonist") return `${styles.roleBadge} ${styles.protagonist}`;
    if (character!.role === "antagonist") return `${styles.roleBadge} ${styles.antagonist}`;
    return styles.roleBadge;
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <h1 className={styles.name}>{character.name}</h1>
            <span className={roleBadgeClass()}>{character.role}</span>
          </div>

          <div className={styles.actions}>
            <button
              onClick={() => setShowStartInterview(true)}
              className={styles.interviewBtn}
            >
              <MessageSquare size={14} />
              Interview
            </button>
            <button
              onClick={() => setShowAiGenerator((s) => !s)}
              className={styles.editBtn}
              title="AI suggestions"
            >
              <Sparkles size={14} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className={styles.editBtn}
              title="Edit character"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>

        <div className={styles.fields}>
          <Field label="Personality" value={character.personality} />
          <Field label="Motivation" value={character.motivation} />
          <Field label="Background" value={character.background} />
          <Field label="Appearance" value={character.appearance} />
          <Field label="Arc Notes" value={character.arc_notes} />

          {/* ── Narrative Intent (author-facing) ── */}
          <div className={styles.intentSection}>
            <div className={styles.intentHeader}>
              <p className={styles.fieldLabel}>Narrative Intent</p>
              <button
                className={styles.intentToggle}
                onClick={toggleIntentHidden}
                title={character.narrative_intent_hidden ? "Hidden from AI interviews" : "Visible in AI writing assistance"}
              >
                {character.narrative_intent_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{character.narrative_intent_hidden ? "Hidden from interviews" : "Shown in writing assistance"}</span>
              </button>
            </div>
            <p className={styles.intentHint}>What is this character FOR in your story? (Arc trajectory, key moments, thematic role.)</p>
            <textarea
              value={intentText}
              onChange={(e) => {
                setIntentText(e.target.value);
                scheduleIntentSave(e.target.value);
              }}
              placeholder="Will start loyal, lose faith in Act 2, and ultimately betray the protagonist to save someone they love…"
              className={styles.intentTextarea}
              rows={3}
            />
          </div>

          {/* ── Arc Milestones ── */}
          <div className={styles.milestonesSection}>
            <p className={styles.fieldLabel}>Arc Milestones</p>
            <p className={styles.intentHint}>Checkable waypoints for this character's journey. Track progress as you write.</p>
            <div className={styles.milestoneList}>
              {(character.arc_milestones ?? []).map((m) => (
                <div key={m.id} className={`${styles.milestoneItem} ${m.completed ? styles.milestoneDone : ""}`}>
                  <button
                    className={styles.milestoneCheck}
                    onClick={() => toggleMilestone(m.id, m.completed)}
                    aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {m.completed ? <Check size={10} /> : null}
                  </button>
                  <span className={styles.milestoneText}>{m.text}</span>
                  <button
                    className={styles.milestoneDelete}
                    onClick={() => removeMilestone(m.id)}
                    aria-label="Remove milestone"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.milestoneAdd}>
              <input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                placeholder="Add a milestone…"
                className={styles.milestoneInput}
              />
              <button onClick={addMilestone} className={styles.milestoneAddBtn} disabled={!newMilestone.trim()}>
                <Plus size={13} />
              </button>
            </div>
          </div>

          {character.interview_prompts && character.interview_prompts.length > 0 && (
            <div className={styles.promptsSection}>
              <p className={styles.fieldLabel}>Interview Prompts</p>
              <div className={styles.promptList}>
                {character.interview_prompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setShowStartInterview(true)}
                    className={styles.promptCard}
                  >
                    <span>{prompt}</span>
                    <ChevronRight size={13} className={styles.promptArrow} />
                  </button>
                ))}
              </div>
              <p className={styles.promptsHint}>Click a prompt to start an interview</p>
            </div>
          )}

          {character.traits && Object.keys(character.traits).length > 0 && (
            <div className={styles.traitsSection}>
              <p className={styles.fieldLabel}>Traits</p>
              <div className={styles.traitsList}>
                {Object.entries(character.traits).map(([key, value]) => (
                  <div key={key} className={styles.traitTag}>
                    <span className={styles.traitKey}>{key}:</span> {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Character Attributes ── */}
          <div className={styles.attributesSection}>
            <p className={styles.fieldLabel}>Character Attributes</p>
            <p className={styles.attributesHint}>
              Shapes vocabulary, tone, and behaviour during interviews. Leave as Unknown to discover through writing.
            </p>
            <div className={styles.attributesGrid}>
              {ATTRIBUTE_DEFS.map(({ key, label, options }) => {
                const value = character.attributes?.[key] ?? "unknown";
                const isUnknown = !value || value === "unknown";
                return (
                  <div key={key} className={styles.attributeRow}>
                    <span className={styles.attributeLabel}>{label}</span>
                    <select
                      className={styles.attributeSelect}
                      value={isUnknown ? "unknown" : value}
                      data-unknown={isUnknown ? "true" : "false"}
                      onChange={(e) => updateAttribute(key, e.target.value)}
                    >
                      <option value="unknown">Unknown</option>
                      {options.map((o) => (
                        <option key={o} value={o.toLowerCase().replace(" ", "_")}>{o}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {storyId && (
            <AssetPicker
              storyId={storyId}
              objectType="character"
              objectId={character.id}
              defaultRole="portrait"
              label="Images & References"
            />
          )}
        </div>
      </div>

      {showAiGenerator && (
        <AttributeGeneratorPanel
          character={character}
          onClose={() => setShowAiGenerator(false)}
        />
      )}

      {editing && (
        <CharacterFormDialog
          storyId={storyId!}
          character={character}
          onClose={() => setEditing(false)}
        />
      )}

      {showStartInterview && (
        <StartInterviewDialog
          character={character}
          onStarted={handleInterviewStarted}
          onClose={() => setShowStartInterview(false)}
        />
      )}
    </div>
  );
}
