import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  CHARACTER_TYPES,
  JUNGIAN_ARCHETYPES,
  NARRATIVE_ARCHETYPES,
  type ClassificationOption,
} from "../../../lib/characters/classifications";
import { KINDS } from "../../../lib/lorebook/kinds";
import type { Character } from "../../../types";
import Term from "../../common/Term";
import FieldList from "../FieldList";
import styles from "./CraftLenses.module.css";

/** What the character is for, in the fold with the other lenses (doc 30 D6). */
const INTENT = KINDS.character.fields.filter((f) => f.key === "narrative_intent");

type LensKey = "character_type" | "jungian_archetype" | "narrative_archetype";

const LENSES: { key: LensKey; label: ReactNode; from: string; options: ClassificationOption[] }[] = [
  {
    key: "character_type",
    label: <Term id="character-type">Character type</Term>,
    from: "How deep they go, and whether they change",
    options: CHARACTER_TYPES,
  },
  {
    key: "jungian_archetype",
    label: (
      <>
        Jungian <Term id="archetype">archetype</Term>
      </>
    ),
    from: "Who they are at heart, from Carl Jung's twelve",
    options: JUNGIAN_ARCHETYPES,
  },
  {
    key: "narrative_archetype",
    label: "Narrative archetype",
    from: "The part they play, from the Hero's Journey",
    options: NARRATIVE_ARCHETYPES,
  },
];

/**
 * Craft lenses (doc 30 D6): a character's type, both archetypes and what they're for, folded
 * away under one name. Each is optional, a way of looking rather than a box to fill; the fold
 * says which are set while it is closed, so nothing is hidden that the writer chose.
 */
export default function CraftLenses({
  character,
  save,
}: {
  character: Character;
  save: (patch: Partial<Character>) => Promise<unknown>;
}) {
  const set = LENSES.map((l) => l.options.find((o) => o.value === character[l.key])?.label).filter(Boolean);
  const [open, setOpen] = useState(false);

  return (
    <details className={styles.fold} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.summary}>
        <ChevronRight size={13} className={styles.chevron} aria-hidden />
        <span className={styles.title}>Craft lenses</span>
        <span className={styles.set}>{set.length ? set.join(" · ") : "Optional"}</span>
      </summary>
      <div className={styles.body}>
        <p className={styles.lede}>
          <Term id="craft-lenses">Craft lenses</Term> are ways of looking at a character that writing books
          use. Take any that help, and leave the rest empty.
        </p>
        <div className={styles.grid}>
          {LENSES.map((l) => {
            const value = (character[l.key] as string | null) ?? "";
            const chosen = l.options.find((o) => o.value === value);
            return (
              <div key={l.key} className={styles.lens}>
                <label className={styles.label} htmlFor={`lens-${l.key}`}>
                  {l.label}
                </label>
                <span className={styles.from}>{l.from}</span>
                <select
                  id={`lens-${l.key}`}
                  className={styles.select}
                  value={value}
                  onChange={(e) => void save({ [l.key]: e.target.value } as Partial<Character>)}
                >
                  <option value="">None</option>
                  {l.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {chosen && <span className={styles.meaning}>{chosen.description}</span>}
              </div>
            );
          })}
        </div>
        <FieldList
          entityKey={`${character.id}:lenses`}
          fields={INTENT}
          values={character as unknown as Record<string, unknown>}
          save={(key, value) => save({ [key]: value } as Partial<Character>)}
        />
      </div>
    </details>
  );
}
