import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import SubjectNotes from "../notes/SubjectNotes";
import { Link } from "react-router-dom";
import { KINDS } from "../../lib/lorebook/kinds";
import { whoLine } from "../../lib/lorebook/whoAreThey";
import { sectionPath } from "../../lib/routes";
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

  const who = whoLine(character);
  return (
    <>
      <section className={styles.section}>
        {who && activeStory && (
          // Who they are, in one quiet line, to the sheet's view of it (doc 20 P6).
          <Link
            className={styles.whoLine}
            to={`${sectionPath(activeStory.id, "lorebook", "characters", character.id)}?tab=who`}
            title="Who are they, on the full sheet"
          >
            {who}
          </Link>
        )}
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
          <h4 className={styles.heading}>Notes and questions</h4>
          <SubjectNotes
            storyId={activeStory.id}
            aboutType="character"
            aboutId={character.id}
            name={character.name}
          />
        </section>
      )}
    </>
  );
}
