import { useLayoutEffect, useRef, useState } from "react";
import { api } from "../../../api/client";
import type { Character, Location, Story, StructureNode } from "../../../types";
import { useStoryStore } from "../../../stores/storyStore";
import SceneSettingsField from "./SceneSettingsField";
import ChecksField from "./ChecksField";
import QuotesField from "./QuotesField";
import styles from "../SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  activeStory: Story | null;
  characters: Character[];
  locations: Location[];
}

const OVERVIEW_SAVE_DEBOUNCE_MS = 900;

function TextField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  hint?: string;
}) {
  // At rest a filled field is two lines of its text; reaching it opens the whole answer to
  // edit (doc 14 review: six full paragraphs beside the prose competed with it).
  const [editing, setEditing] = useState(false);
  // Grow with the text: in the side column a fixed two rows cut most answers off.
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, editing]);
  const folded = !editing && value.trim().length > 0;
  return (
    <div className={styles.overviewField}>
      <label className={styles.overviewLabel}>{label}</label>
      {folded ? (
        <button
          type="button"
          className={styles.overviewPreview}
          onClick={() => setEditing(true)}
          aria-label={`${label}: ${value}. Edit`}
        >
          <span className={styles.overviewClamp}>{value}</span>
        </button>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          className={styles.overviewTextarea}
          rows={2}
          autoFocus={editing}
        />
      )}
      {hint && !folded && <p className={styles.overviewHint}>{hint}</p>}
    </div>
  );
}

/**
 * The scene's own fields, in the order the scene runs: what needs your eye, where things
 * stand going in, what happens and why, where they stand coming out, then beat, POV and
 * setting. Notes, links, images and the Assistant fold below it (SceneMoreFields), so the
 * scene before and the scene after sit right against its entry and exit states.
 */
export default function SceneOverviewPanel({ activeNode, activeStory, characters, locations }: Props) {
  // The scene's point of view, or the story's default: the person entry and exit states are about.
  const povId = activeNode.pov_character_id ?? activeStory?.pov_character_id;
  const povName = characters.find((c) => c.id === povId)?.name;
  const { setActiveNode, beatSheets } = useStoryStore();
  // Seeded once per node: the parent renders this panel with key={activeNode.id}.
  const [synopsis, setSynopsis] = useState(activeNode.synopsis ?? "");
  const [purpose, setPurpose] = useState(activeNode.purpose ?? "");
  const [entryState, setEntryState] = useState(activeNode.entry_state ?? "");
  const [exitState, setExitState] = useState(activeNode.exit_state ?? "");
  const [keyEvents, setKeyEvents] = useState(activeNode.key_events ?? "");
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beatSheet = activeStory?.beat_sheet_id
    ? (beatSheets.find((s) => s.id === activeStory.beat_sheet_id) ?? null)
    : null;

  async function patch(fields: Parameters<typeof api.updateNode>[1]) {
    const updated = await api.updateNode(activeNode.id, fields);
    setActiveNode({ ...activeNode, ...updated });
  }

  function scheduleSave(fields: Parameters<typeof api.updateNode>[1]) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => patch(fields), OVERVIEW_SAVE_DEBOUNCE_MS);
  }

  const showPov =
    activeStory &&
    (activeStory.narrative_perspective === "first_person" ||
      activeStory.narrative_perspective === "multiple_pov");

  return (
    <div className={styles.overviewPanel}>
      <ChecksField activeNode={activeNode} />
      <TextField
        label="Entry state"
        value={entryState}
        onChange={setEntryState}
        onBlur={() => patch({ entry_state: entryState })}
        placeholder={`Who is ${povName ?? "your point-of-view character"} before this scene begins? What do they believe?`}
      />
      <TextField
        label="Synopsis"
        value={synopsis}
        onChange={(v) => {
          setSynopsis(v);
          scheduleSave({ synopsis: v });
        }}
        placeholder="Brief summary of what happens in this segment…"
      />
      <TextField
        label="Purpose"
        value={purpose}
        onChange={(v) => {
          setPurpose(v);
          scheduleSave({ purpose: v });
        }}
        placeholder="Why does this segment exist? What narrative function does it serve?"
        hint="Consider: Where are things at the start? Where should they be at the end? What key events need to happen?"
      />
      <TextField
        label="Key events"
        value={keyEvents}
        onChange={setKeyEvents}
        onBlur={() => patch({ key_events: keyEvents })}
        placeholder="What must happen in this scene? List the pivotal moments or turning points."
      />
      <TextField
        label="Exit state"
        value={exitState}
        onChange={setExitState}
        onBlur={() => patch({ exit_state: exitState })}
        placeholder="How has the character or situation changed by the end of this scene?"
      />

      {beatSheet && (
        <div className={styles.overviewField}>
          <label className={styles.overviewLabel}>Beat</label>
          <select
            aria-label="Beat"
            className={styles.overviewSelect}
            value={activeNode.beat_id ?? ""}
            onChange={(e) => patch({ beat_id: e.target.value || null })}
          >
            <option value="">None</option>
            {beatSheet.beats.map((beat) => (
              <option key={beat.id} value={beat.id}>
                {beat.position_pct}% · {beat.name}
              </option>
            ))}
          </select>
          {activeNode.beat_id &&
            (() => {
              const b = beatSheet.beats.find((b) => b.id === activeNode.beat_id);
              return b?.description ? <p className={styles.overviewHint}>{b.description}</p> : null;
            })()}
        </div>
      )}

      {showPov && activeStory && (
        <div className={styles.overviewField}>
          <label className={styles.overviewLabel}>POV character</label>
          <p className={styles.overviewHint}>
            Override the story-level narrator for this scene. Use for multiple-POV stories with alternating
            perspectives.
          </p>
          <select
            aria-label="POV character"
            className={styles.overviewSelect}
            value={activeNode.pov_character_id ?? ""}
            onChange={(e) => patch({ pov_character_id: e.target.value || null })}
          >
            <option value="">
              {activeStory.pov_character_id
                ? `Story default (${characters.find((c) => c.id === activeStory.pov_character_id)?.name ?? "Unknown"})`
                : "Story default (none)"}
            </option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <SceneSettingsField activeNode={activeNode} locations={locations} />
      <QuotesField activeNode={activeNode} />
    </div>
  );
}
