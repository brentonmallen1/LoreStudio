import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import {
  CHARACTER_FIELD_LABELS,
  characterDone,
  mainCharacters,
  type CharacterPlanField,
  type PlanStep,
} from "../../lib/planning/methods";
import { humanize } from "../../lib/labels";
import AssistantRow from "../lorebook/AssistantRow";
import PlanGuidance from "./PlanGuidance";
import { useAutosaveField } from "./useAutosaveField";
import styles from "./Plan.module.css";

interface Props {
  storyId: string;
  step: PlanStep & { target: { kind: "characters"; fields: CharacterPlanField[] } };
}

/** A step answered once per main character: their goal, conflict, arc… */
export default function CharacterStep({ storyId, step }: Props) {
  const characters = useStoryStore((s) => s.characters);
  const main = mainCharacters(characters);
  // Picked once, so finishing one character's last field never swaps the editor mid-word.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (main.find((c) => !characterDone(c, step.target.fields)) ?? main[0])?.id ?? null,
  );
  const selected = main.find((c) => c.id === selectedId) ?? main[0];

  return (
    <div className={styles.stepBody}>
      <div className={styles.cast} role="tablist" aria-label="Characters">
        {main.map((c) => {
          const done = characterDone(c, step.target.fields);
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === selected?.id}
              className={`${styles.castChip} ${c.id === selected?.id ? styles.castChipActive : ""}`}
              onClick={() => setSelectedId(c.id)}
            >
              {done ? <CheckCircle2 size={12} className={styles.done} /> : <Circle size={12} />}
              {c.name}
            </button>
          );
        })}
        <AddCharacter storyId={storyId} first={main.length === 0} onAdded={setSelectedId} />
      </div>

      {selected ? (
        <CharacterFields key={selected.id} storyId={storyId} character={selected} step={step} />
      ) : (
        <p className={styles.quiet}>Add the character this story is about. You can add the rest as you go.</p>
      )}
    </div>
  );
}

function CharacterFields({
  storyId,
  character,
  step,
}: { storyId: string; character: Character } & Pick<Props, "step">) {
  const [guidance, setGuidance] = useState(false);
  const firstPerson = step.target.fields.includes("arc_in_own_words");
  return (
    <>
      <div className={styles.castHeader}>
        <span className={styles.castRole}>{humanize(character.role)}</span>
        <Link to={`/stories/${storyId}/lorebook/characters/${character.id}`} className={styles.quietLink}>
          Open character sheet
        </Link>
      </div>
      {step.target.fields.map((f) => (
        <CharacterField key={f} character={character} field={f} rows={firstPerson ? 12 : 2} />
      ))}
      {step.guidanceLayer && !guidance && (
        <AssistantRow
          actions={[
            {
              label: "Get guidance on this answer",
              title: "The Assistant reads what you have written here and asks what it leaves open",
              onRun: () => setGuidance(true),
            },
          ]}
        />
      )}
      {guidance && step.guidanceLayer && (
        <PlanGuidance
          storyId={storyId}
          layer={step.guidanceLayer}
          content={step.target.fields
            .map((f) => `${CHARACTER_FIELD_LABELS[f].label}: ${character[f] ?? ""}`)
            .join("\n")}
          characterId={character.id}
          onClose={() => setGuidance(false)}
        />
      )}
    </>
  );
}

function CharacterField({
  character,
  field,
  rows,
}: {
  character: Character;
  field: CharacterPlanField;
  rows: number;
}) {
  const upsertCharacter = useStoryStore((s) => s.upsertCharacter);
  const { value, change, flush } = useAutosaveField(character[field] ?? "", async (v) => {
    upsertCharacter(await api.updateCharacter(character.id, { [field]: v }));
  });
  const meta = CHARACTER_FIELD_LABELS[field];
  const id = `plan-${character.id}-${field}`;
  return (
    <div className={styles.charField}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {meta.label}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        rows={rows}
        placeholder={meta.placeholder}
      />
    </div>
  );
}

function AddCharacter({
  storyId,
  first,
  onAdded,
}: {
  storyId: string;
  first: boolean;
  onAdded: (id: string) => void;
}) {
  const upsertCharacter = useStoryStore((s) => s.upsertCharacter);
  const [open, setOpen] = useState(first);
  const [name, setName] = useState("");
  const [role, setRole] = useState(first ? "protagonist" : "deuteragonist");

  async function add() {
    if (!name.trim()) return;
    const created = await api.createCharacter(storyId, { name: name.trim(), role });
    upsertCharacter(created);
    onAdded(created.id);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button className={styles.castAdd} onClick={() => setOpen(true)}>
        <Plus size={12} />
        Add character
      </button>
    );
  }
  return (
    <form
      className={styles.castForm}
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <input
        autoFocus
        className={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        aria-label="Character name"
      />
      <select
        className={styles.input}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        aria-label="Role"
      >
        {["protagonist", "deuteragonist", "antagonist", "love_interest", "confidant", "foil"].map((r) => (
          <option key={r} value={r}>
            {humanize(r)}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.primaryBtn} disabled={!name.trim()}>
        Add
      </button>
      {!first && (
        <button type="button" className={styles.quietBtn} onClick={() => setOpen(false)}>
          Cancel
        </button>
      )}
    </form>
  );
}
