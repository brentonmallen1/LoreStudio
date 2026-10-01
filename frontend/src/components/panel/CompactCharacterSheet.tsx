import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import QuestionsList from "../plan/QuestionsList";
import { KINDS } from "../../lib/lorebook/kinds";
import FieldList from "../lorebook/FieldList";
import SlotPicker from "../common/SlotPicker";
import styles from "./Panel.module.css";

/** The fields the Lorebook marks compact: the full sheet's top half (doc 12 D2). */
const COMPACT_FIELDS = KINDS.character.fields.filter((f) => f.compact);

/**
 * A character beside the prose (doc 11): what they want and what stands in the way,
 * the profile fields most useful mid-scene, and their open questions. The Lorebook's own
 * field table, so editing either is editing the character, and an empty field is a word.
 */
export default function CompactCharacterSheet({ character }: { character: Character }) {
  const { activeStory, upsertCharacter, setCharacters } = useStoryStore();
  useReloadOnUndo(["character"], () => {
    if (activeStory) api.listCharacters(activeStory.id).then(setCharacters);
  });

  return (
    <>
      <section className={styles.section}>
        <SlotPicker
          size="sm"
          value={character.color_slot}
          onChange={(slot) => api.updateCharacter(character.id, { color_slot: slot }).then(upsertCharacter)}
        />
        <FieldList
          entityKey={character.id}
          fields={COMPACT_FIELDS}
          values={character as unknown as Record<string, unknown>}
          save={(key, value) => api.updateCharacter(character.id, { [key]: value }).then(upsertCharacter)}
        />
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
