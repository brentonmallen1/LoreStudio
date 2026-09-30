import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import { PROFILE_FIELDS } from "../characters/profileFields";
import QuestionsList from "../plan/QuestionsList";
import AutosaveTextarea from "./AutosaveTextarea";
import SlotPicker from "../common/SlotPicker";
import styles from "./Panel.module.css";

const COMPACT_KEYS = new Set(["personality", "motivation", "flaws"]);

/**
 * A character beside the prose (doc 11): what they want and what stands in the way,
 * the three profile fields most useful mid-scene, and their open questions. The same
 * fields as the full sheet, so editing either is editing the character.
 */
export default function CompactCharacterSheet({ character }: { character: Character }) {
  const { activeStory, upsertCharacter, setCharacters } = useStoryStore();
  useReloadOnUndo(["character"], () => {
    if (activeStory) api.listCharacters(activeStory.id).then(setCharacters);
  });

  const save = (key: keyof Character) => (value: string) =>
    api.updateCharacter(character.id, { [key]: value }).then(upsertCharacter);

  return (
    <>
      <section className={styles.section}>
        <SlotPicker
          size="sm"
          value={character.color_slot}
          onChange={(slot) => api.updateCharacter(character.id, { color_slot: slot }).then(upsertCharacter)}
        />
        <AutosaveTextarea
          key={`${character.id}:wants`}
          label="Wants"
          initial={character.mission_statement ?? ""}
          placeholder="What they are after…"
          save={save("mission_statement")}
        />
        <AutosaveTextarea
          key={`${character.id}:against`}
          label="Against"
          initial={character.conflict ?? ""}
          placeholder="What stands between them and it…"
          save={save("conflict")}
        />
        {PROFILE_FIELDS.filter((f) => COMPACT_KEYS.has(f.key)).map((f) => (
          <AutosaveTextarea
            key={`${character.id}:${f.key}`}
            label={f.label}
            initial={(character[f.key] as string) ?? ""}
            placeholder={f.placeholder}
            save={save(f.key)}
          />
        ))}
      </section>
      {activeStory && (
        <section className={styles.section}>
          <h4 className={styles.heading}>Open questions</h4>
          <QuestionsList
            storyId={activeStory.id}
            subject={{ about_type: "character", about_id: character.id }}
            compact
            placeholder="Something undecided about them… (Enter)"
          />
        </section>
      )}
    </>
  );
}
