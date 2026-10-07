import { useState } from "react";
import { IDENTITY_FIELDS } from "../../lib/lorebook/whoAreThey";
import styles from "./CharacterFormDialog.module.css";

const PRONOUN_PRESETS = ["he/him", "she/her", "they/them"];
const GENDERS = IDENTITY_FIELDS.find((f) => f.key === "gender")?.options ?? [];

/**
 * Pronouns and gender, side by side in the character form (doc 20 P6): two different things,
 * so neither is guessed from the other. Gender is free text with suggestions; pronouns a preset
 * or the author's own.
 */
export default function PronounsAndGender({
  pronouns,
  gender,
  onPronouns,
  onGender,
}: {
  pronouns: string;
  gender: string;
  onPronouns: (value: string) => void;
  onGender: (value: string) => void;
}) {
  const [custom, setCustom] = useState(!!pronouns && !PRONOUN_PRESETS.includes(pronouns));
  return (
    <div className={styles.grid2}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="character-pronouns">
          Pronouns
        </label>
        <div className={styles.pronounsRow}>
          <select
            id="character-pronouns"
            value={custom ? "custom" : pronouns}
            onChange={(e) => {
              setCustom(e.target.value === "custom");
              onPronouns(e.target.value === "custom" ? "" : e.target.value);
            }}
            className={styles.select}
          >
            <option value="">Not specified</option>
            {PRONOUN_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="custom">Their own…</option>
          </select>
          {custom && (
            <input
              aria-label="Their pronouns"
              value={pronouns}
              onChange={(e) => onPronouns(e.target.value)}
              placeholder="e.g. xe/xem"
              className={styles.input}
            />
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="character-gender">
          Gender
        </label>
        <input
          id="character-gender"
          list="character-gender-options"
          value={gender}
          onChange={(e) => onGender(e.target.value)}
          placeholder="In the words they'd use…"
          className={styles.input}
        />
        <datalist id="character-gender-options">
          {GENDERS.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o} />
            ) : (
              <option key={o.value} value={o.value} label={`${o.value} (${o.note})`} />
            ),
          )}
        </datalist>
      </div>
    </div>
  );
}
