import { formatCombo, SHORTCUTS } from "../../lib/keyboard/shortcuts";
import { FORMATS } from "../../lib/storyFormat";
import type { Character, StoryFormat } from "../../types";
import styles from "./StoryIdentityPanel.module.css";

// Story identity fields about how the story is told, used by StoryIdentityPanel.

const PERSPECTIVES: [string, string][] = [
  ["", "Not specified"],
  ["first_person", "First person"],
  ["third_limited", "Third person limited"],
  ["third_omniscient", "Third person omniscient"],
  ["second_person", "Second person"],
  ["multiple_pov", "Multiple POV"],
];

/** Point of view, and whose when it is one character's. A script has no narrator, so none. */
export function PerspectiveField(props: {
  perspective: string;
  povCharacterId: string;
  characters: Character[];
  onPerspective: (value: string) => void;
  onPovCharacter: (id: string) => void;
}) {
  const oneCharacter = props.perspective === "first_person" || props.perspective === "third_limited";
  return (
    <div>
      <p className={styles.subFieldLabel}>Narrative perspective</p>
      <p className={styles.fieldHint}>
        Point of view for the story. Guides AI tools on voice and perspective.
      </p>
      <select
        value={props.perspective}
        onChange={(e) => props.onPerspective(e.target.value)}
        className={styles.input}
      >
        {PERSPECTIVES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {oneCharacter && (
        <div className={styles.subField}>
          <p className={styles.subFieldLabel}>POV character</p>
          <select
            value={props.povCharacterId}
            onChange={(e) => props.onPovCharacter(e.target.value)}
            className={styles.input}
          >
            <option value="">Not specified</option>
            {props.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Prose or screenplay (doc 25). Switching rewrites nothing, and ⌘Z switches back. */
export function FormatField(props: { value: StoryFormat; onChange: (value: StoryFormat) => void }) {
  return (
    <div>
      <p className={styles.subFieldLabel}>Written as</p>
      <p className={styles.fieldHint}>
        Switching keeps every word: prose paragraphs read as action lines until you change them, and{" "}
        {formatCombo(SHORTCUTS.undo.combo)} switches back.
      </p>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as StoryFormat)}
        className={styles.input}
      >
        {FORMATS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}
