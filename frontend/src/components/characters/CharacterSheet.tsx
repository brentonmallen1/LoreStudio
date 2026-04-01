import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Edit2, MessageSquare, ChevronRight } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import CharacterFormDialog from "./CharacterFormDialog";
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
  const { openInterview } = useUIStore();
  const [editing, setEditing] = useState(false);
  const [startingInterview, setStartingInterview] = useState(false);

  const character = characters.find((c) => c.id === characterId);

  useEffect(() => {
    if (!characterId || character) return;
    api.getCharacter(characterId).then(upsertCharacter).catch(console.error);
  }, [characterId]);

  async function handleStartInterview() {
    if (!character) return;
    setStartingInterview(true);
    try {
      const interview = await api.startInterview(character.id, `Interview with ${character.name}`);
      openInterview(interview, character);
    } finally {
      setStartingInterview(false);
    }
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
              onClick={handleStartInterview}
              disabled={startingInterview}
              className={styles.interviewBtn}
            >
              <MessageSquare size={14} />
              Interview
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

          {character.interview_prompts && character.interview_prompts.length > 0 && (
            <div className={styles.promptsSection}>
              <p className={styles.fieldLabel}>Interview Prompts</p>
              <div className={styles.promptList}>
                {character.interview_prompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={handleStartInterview}
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
        </div>
      </div>

      {editing && (
        <CharacterFormDialog
          storyId={storyId!}
          character={character}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
