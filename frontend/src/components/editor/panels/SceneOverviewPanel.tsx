import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Telescope } from "lucide-react";
import { api } from "../../../api/client";
import type { Character, DiagramSummary, Location, Story, StructureNode } from "../../../types";
import { useStoryStore } from "../../../stores/storyStore";
import { useDiscoveryStore } from "../../../stores/discoveryStore";
import DiagramThumbnail from "../../media/DiagramThumbnail";
import AssetPicker from "../../media/AssetPicker";
import type { InlineNotesState } from "../useInlineNotes";
import { flattenStructure } from "../segmentMeta";
import SceneSettingsField from "./SceneSettingsField";
import SceneSummaryField from "./SceneSummaryField";
import InlineNotesField from "./InlineNotesField";
import SceneLinksField from "./SceneLinksField";
import LinkedTwistsField from "./LinkedTwistsField";
import styles from "../SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  activeStory: Story | null;
  characters: Character[];
  locations: Location[];
  notes: InlineNotesState;
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
  return (
    <div className={styles.overviewField}>
      <label className={styles.overviewLabel}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={styles.overviewTextarea}
        rows={2}
      />
      {hint && <p className={styles.overviewHint}>{hint}</p>}
    </div>
  );
}

/** The "Notes" side panel: synopsis, purpose, states, beat, POV, settings, summary, notes, links. */
export default function SceneOverviewPanel({ activeNode, activeStory, characters, locations, notes }: Props) {
  const { setActiveNode, structure, beatSheets, activeTemplate: _t } = useStoryStore();
  const { runDiscovery, isAnalyzing } = useDiscoveryStore();
  const navigate = useNavigate();
  // Seeded once per node: the parent renders this panel with key={activeNode.id}.
  const [synopsis, setSynopsis] = useState(activeNode.synopsis ?? "");
  const [purpose, setPurpose] = useState(activeNode.purpose ?? "");
  const [entryState, setEntryState] = useState(activeNode.entry_state ?? "");
  const [exitState, setExitState] = useState(activeNode.exit_state ?? "");
  const [keyEvents, setKeyEvents] = useState(activeNode.key_events ?? "");
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beatSheet = activeStory?.beat_sheet_id
    ? (beatSheets.find((s) => s.id === activeStory.beat_sheet_id) ?? null)
    : null;

  useEffect(() => {
    if (!activeStory) return;
    api
      .listDiagrams(activeStory.id)
      .then((all) => setDiagrams(all.filter((d) => d.attached_node_id === activeNode.id)))
      .catch(() => {});
  }, [activeNode.id, activeStory?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        label="Entry State"
        value={entryState}
        onChange={setEntryState}
        onBlur={() => patch({ entry_state: entryState })}
        placeholder="Who is Maya before this scene begins? What does she believe?"
      />
      <TextField
        label="Exit State"
        value={exitState}
        onChange={setExitState}
        onBlur={() => patch({ exit_state: exitState })}
        placeholder="How has the character or situation changed by the end of this scene?"
      />
      <TextField
        label="Key Events"
        value={keyEvents}
        onChange={setKeyEvents}
        onBlur={() => patch({ key_events: keyEvents })}
        placeholder="What must happen in this scene? List the pivotal moments or turning points."
      />

      {beatSheet && (
        <div className={styles.overviewField}>
          <label className={styles.overviewLabel}>Beat</label>
          <select
            className={styles.overviewSelect}
            value={activeNode.beat_id ?? ""}
            onChange={(e) => patch({ beat_id: e.target.value || null })}
          >
            <option value="">— None —</option>
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
          <label className={styles.overviewLabel}>POV Character</label>
          <p className={styles.overviewHint}>
            Override the story-level narrator for this scene. Use for multiple-POV stories with alternating
            perspectives.
          </p>
          <select
            className={styles.overviewSelect}
            value={activeNode.pov_character_id ?? ""}
            onChange={(e) => patch({ pov_character_id: e.target.value || null })}
          >
            <option value="">
              {activeStory.pov_character_id
                ? `Story default (${characters.find((c) => c.id === activeStory.pov_character_id)?.name ?? "Unknown"})`
                : "— Story default (none) —"}
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
      <SceneSummaryField activeNode={activeNode} setActiveNode={setActiveNode} />
      <InlineNotesField notes={notes} />
      {activeStory && (
        <SceneLinksField
          activeNode={activeNode}
          activeStory={activeStory}
          flatNodes={flattenStructure(structure)}
          onNavigate={setActiveNode}
        />
      )}

      {diagrams.length > 0 && activeStory && (
        <div className={styles.overviewField}>
          <div className={styles.linkedHeader}>
            <label className={styles.overviewLabel}>Diagrams</label>
          </div>
          <div className={styles.diagramThumbnails}>
            {diagrams.map((d) => (
              <DiagramThumbnail
                key={d.id}
                diagram={d}
                onClick={() => navigate(`/stories/${activeStory.id}/worldbuilding`)}
              />
            ))}
          </div>
        </div>
      )}

      {activeStory?.discovery_enabled && (
        <div className={styles.overviewField}>
          <button
            className={styles.analyzeBtn}
            onClick={() => runDiscovery(activeNode.story_id, activeNode.id).catch(() => {})}
            disabled={isAnalyzing}
            title="Analyze this scene for new characters, settings, and other story elements"
          >
            <Telescope size={12} />
            {isAnalyzing ? "Analyzing…" : "Analyze for discoveries"}
          </button>
        </div>
      )}

      {activeStory && <LinkedTwistsField activeNode={activeNode} activeStory={activeStory} />}

      {activeStory && (
        <div className={styles.overviewField}>
          <AssetPicker
            storyId={activeStory.id}
            objectType="structure_node"
            objectId={activeNode.id}
            label="Images & References"
          />
        </div>
      )}
    </div>
  );
}
