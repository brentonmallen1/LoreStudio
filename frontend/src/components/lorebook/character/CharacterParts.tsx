import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { api } from "../../../api/client";
import { sceneLeaves } from "../../../lib/planning/methods";
import { useStoryStore } from "../../../stores/storyStore";
import type { Character, CharacterAttributes } from "../../../types";
import styles from "../Lorebook.module.css";

/**
 * The character sheet's smaller parts (doc 12 P2), out of the old 900-line sheet so the
 * one Lorebook sheet can place them: arc milestones, discovery notes, attributes,
 * interview prompts and free traits. Each saves at once and hands the saved character back.
 */

type Saved = (c: Character) => void;

/** One line to add something: a text box and a + that only lights up with text in it. */
function AddLine({
  placeholder,
  onAdd,
  label,
}: {
  placeholder: string;
  label: string;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div className={styles.rowEdit}>
      <input
        className={`${styles.inlineInput} ${styles.grow}`}
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={label}
        disabled={!text.trim()}
        onClick={submit}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

/** Checkable waypoints of the character's journey, each tied to the scene where it happens. */
export function ArcMilestones({ character, onSaved }: { character: Character; onSaved: Saved }) {
  const { structure, activeTemplate } = useStoryStore();
  const navigate = useNavigate();
  const scenes = sceneLeaves(structure, activeTemplate);
  const milestones = character.arc_milestones ?? [];
  const scenePicker = (m: (typeof milestones)[number]) => (
    <select
      className={styles.quietSelect}
      aria-label={`Scene for “${m.text}”`}
      value={m.scene_id ?? ""}
      onChange={async (e) => {
        const node = scenes.find((n) => n.id === e.target.value);
        onSaved(
          await api.updateMilestone(character.id, m.id, {
            text: m.text,
            completed: m.completed,
            scene_id: e.target.value || null,
            scene_title: node ? node.title : null,
          }),
        );
      }}
    >
      <option value="">{m.scene_id ? "Unlink scene" : "Link a scene…"}</option>
      {scenes.map((n) => (
        <option key={n.id} value={n.id}>
          {n.title || "Untitled scene"}
        </option>
      ))}
    </select>
  );

  return (
    <div className={styles.rows}>
      {milestones.length === 0 && (
        <p className={styles.cardEmpty}>Waypoints of their journey, ticked off as you write them.</p>
      )}
      {milestones.map((m) => (
        <div
          key={m.id}
          className={styles.milestone}
          data-done={m.completed || undefined}
          data-linked={m.scene_id ? true : undefined}
        >
          <button
            type="button"
            className={styles.check}
            aria-label={m.completed ? `Mark “${m.text}” not done` : `Mark “${m.text}” done`}
            aria-pressed={m.completed}
            onClick={async () =>
              onSaved(
                await api.updateMilestone(character.id, m.id, { text: m.text, completed: !m.completed }),
              )
            }
          >
            {m.completed && <Check size={10} strokeWidth={3} />}
          </button>
          <div className={styles.milestoneBody}>
            <span className={styles.milestoneText}>{m.text}</span>
            {m.scene_id && (
              <div className={styles.milestoneMeta}>
                {
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => navigate(`/stories/${character.story_id}/write/${m.scene_id}`)}
                  >
                    {m.scene_title ?? "Linked scene"} →
                  </button>
                }
                {scenePicker(m)}
              </div>
            )}
          </div>
          {/* Unlinked: the picker waits beside the row, shown on hover, so it holds no line of
              its own (doc 13 P7: each unlinked milestone used to carry an empty row). */}
          {!m.scene_id && scenePicker(m)}
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={`Remove “${m.text}”`}
            onClick={async () => onSaved(await api.deleteMilestone(character.id, m.id))}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <AddLine
        placeholder="Add a milestone…"
        label="Add a milestone"
        onAdd={async (text) => onSaved(await api.addMilestone(character.id, text))}
      />
    </div>
  );
}

/** Observations caught while writing, kept as unconfirmed until the author says so. */
export function DiscoveryNotes({ character, onSaved }: { character: Character; onSaved: Saved }) {
  const notes = character.discovery_notes ?? [];
  const [adding, setAdding] = useState(false);
  if (notes.length === 0 && !adding) {
    return (
      <button type="button" className={styles.quietBtn} onClick={() => setAdding(true)}>
        <Plus size={11} aria-hidden />
        Note something you noticed about them
      </button>
    );
  }
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Discovery notes · {notes.length}</span>
      <div className={styles.rows}>
        {notes.map((n) => (
          <div key={n.id} className={styles.note} data-confirmed={n.confirmed || undefined}>
            <div className={styles.milestoneBody}>
              <span className={styles.milestoneText}>{n.text}</span>
              {n.scene_title && <span className={styles.rowNote}>from {n.scene_title}</span>}
            </div>
            {n.confirmed ? (
              <span className={styles.confirmed}>
                <Check size={10} aria-hidden /> Confirmed
              </span>
            ) : (
              <button
                type="button"
                className={styles.quietBtn}
                onClick={async () =>
                  onSaved(await api.updateDiscoveryNote(character.id, n.id, { confirmed: true }))
                }
              >
                Confirm
              </button>
            )}
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Remove this note"
              onClick={async () => onSaved(await api.deleteDiscoveryNote(character.id, n.id))}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <AddLine
          placeholder="Something you noticed while writing…"
          label="Add a discovery note"
          onAdd={async (text) => onSaved(await api.addDiscoveryNote(character.id, { text }))}
        />
      </div>
    </div>
  );
}

type Option = string | { value: string; label: string };

const ATTRIBUTES: { key: keyof CharacterAttributes; label: string; options: Option[] }[] = [
  {
    // How they think, not how well (doc 20 P2): the stored values stay, the words no longer rank.
    key: "intelligence",
    label: "Thinks",
    options: [
      { value: "brilliant", label: "Abstractly" },
      { value: "sharp", label: "Quickly" },
      { value: "average", label: "Practically" },
      { value: "simple", label: "Concretely" },
      { value: "slow", label: "Unhurriedly" },
    ],
  },
  { key: "education", label: "Education", options: ["Scholarly", "Educated", "Common", "Unlettered"] },
  {
    key: "moral_alignment",
    label: "Moral alignment",
    options: ["Righteous", "Principled", "Pragmatic", "Self-Serving", "Corrupt"],
  },
  {
    key: "disposition",
    label: "Disposition",
    options: ["Orderly", "Conventional", "Flexible", "Unpredictable", "Chaotic"],
  },
  {
    key: "temperament",
    label: "Temperament",
    options: ["Serene", "Calm", "Balanced", "Volatile", "Explosive"],
  },
  {
    key: "social_manner",
    label: "Social manner",
    options: ["Refined", "Polished", "Casual", "Rough", "Crude"],
  },
  {
    // How they take things (doc 20 P2): what hurts, beside how fast they boil.
    key: "sensitivity",
    label: "Sensitivity",
    options: [
      { value: "unflappable", label: "Unflappable" },
      { value: "thick_skinned", label: "Thick-skinned" },
      { value: "even", label: "Even" },
      { value: "sensitive", label: "Sensitive" },
      { value: "feels_everything", label: "Feels everything" },
    ],
  },
];

/** How they think and carry themselves; shapes their voice in interviews. Quiet until set. */
export function Attributes({ character, onSaved }: { character: Character; onSaved: Saved }) {
  const set = ATTRIBUTES.filter((a) => {
    const v = character.attributes?.[a.key];
    return v && v !== "unknown";
  });
  const [open, setOpen] = useState(set.length > 0);
  if (!open) {
    return (
      <button type="button" className={styles.quietBtn} onClick={() => setOpen(true)}>
        <Plus size={11} aria-hidden />
        How they think, temperament, sensitivity…
      </button>
    );
  }
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Attributes</span>
      <p className={styles.cardHint}>
        Shapes their vocabulary and tone in interviews. Leave Unknown to find out by writing.
      </p>
      <div className={styles.attrGrid}>
        {ATTRIBUTES.map(({ key, label, options }) => {
          const value = character.attributes?.[key] ?? "unknown";
          return (
            <label key={key} className={styles.attr}>
              <span className={styles.rowLabel}>{label}</span>
              <select
                className={styles.quietSelect}
                value={value || "unknown"}
                data-unknown={!value || value === "unknown" || undefined}
                onChange={async (e) =>
                  onSaved(
                    await api.updateCharacter(character.id, {
                      attributes: { ...character.attributes, [key]: e.target.value },
                    }),
                  )
                }
              >
                <option value="unknown">Unknown</option>
                {options.map((o) => {
                  const { value: v, label: text } =
                    typeof o === "string" ? { value: o.toLowerCase().replace(" ", "_"), label: o } : o;
                  return (
                    <option key={v} value={v}>
                      {text}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Opening questions for an interview; one click starts it. Rendered only where AI is. */
export function InterviewPrompts({
  character,
  onSaved,
  onStart,
}: {
  character: Character;
  onSaved: Saved;
  onStart: () => void;
}) {
  const prompts = character.interview_prompts ?? [];
  return (
    <div className={styles.rows}>
      {prompts.map((p, i) => (
        <div key={i} className={styles.rowEdit}>
          <button type="button" className={styles.promptBtn} onClick={onStart}>
            <span className={styles.grow}>{p}</span>
            <ChevronRight size={12} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Remove this prompt"
            onClick={async () =>
              onSaved(
                await api.updateCharacter(character.id, {
                  interview_prompts: prompts.filter((_, j) => j !== i),
                }),
              )
            }
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <AddLine
        placeholder="A question to open an interview with…"
        label="Add an interview prompt"
        onAdd={async (text) =>
          onSaved(await api.updateCharacter(character.id, { interview_prompts: [...prompts, text] }))
        }
      />
    </div>
  );
}

/** Anything that does not fit a field: "fear · heights". Quiet until there is one. */
export function Traits({ character, onSaved }: { character: Character; onSaved: Saved }) {
  const traits = Object.entries(character.traits ?? {});
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  if (traits.length === 0 && !adding) {
    return (
      <button type="button" className={styles.quietBtn} onClick={() => setAdding(true)}>
        <Plus size={11} aria-hidden />A trait that fits nowhere else
      </button>
    );
  }
  const add = async () => {
    if (!key.trim()) return;
    onSaved(
      await api.updateCharacter(character.id, {
        traits: { ...character.traits, [key.trim()]: value.trim() },
      }),
    );
    setKey("");
    setValue("");
  };
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Traits · {traits.length}</span>
      <div className={styles.rows}>
        {traits.map(([k, v]) => (
          <div key={k} className={styles.cardRow}>
            <span className={styles.rowText}>
              <strong>{k}</strong> · {String(v)}
            </span>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`Remove ${k}`}
              onClick={async () => {
                const next = { ...character.traits };
                delete next[k];
                onSaved(await api.updateCharacter(character.id, { traits: next }));
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <div className={styles.rowEdit}>
          <input
            className={styles.inlineInput}
            value={key}
            placeholder="fear"
            aria-label="Trait"
            onChange={(e) => setKey(e.target.value)}
          />
          <input
            className={`${styles.inlineInput} ${styles.grow}`}
            value={value}
            placeholder="heights"
            aria-label="Value"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
          />
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Add the trait"
            disabled={!key.trim()}
            onClick={add}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
