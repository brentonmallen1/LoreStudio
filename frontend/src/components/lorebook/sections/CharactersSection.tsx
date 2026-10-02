import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Pencil, Trash2, User, Users } from "lucide-react";
import { api } from "../../../api/client";
import { KINDS } from "../../../lib/lorebook/kinds";
import { presenceLine, scenesWith } from "../../../lib/lorebook/presence";
import { sceneLeaves } from "../../../lib/planning/methods";
import { slotVar } from "../../../lib/colorSlots";
import { useAIAvailable } from "../../../lib/mode";
import { useAIStore } from "../../../stores/aiStore";
import { usePanelStore } from "../../../stores/panelStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { Character, Interview } from "../../../types";
import AIOnly from "../../ai/AIOnly";
import ArcAnalysisPanel from "../../characters/ArcAnalysisPanel";
import ArcTimelineView from "../../characters/ArcTimelineView";
import AttributeGeneratorDialog from "../../characters/AttributeGeneratorDialog";
import CharacterDialogueTab from "../../characters/CharacterDialogueTab";
import CharacterDimensionalityPanel from "../../characters/CharacterDimensionalityPanel";
import CharacterFormDialog from "../../characters/CharacterFormDialog";
import RelationshipGraph from "../../characters/RelationshipGraph";
import StartInterviewDialog from "../../characters/StartInterviewDialog";
import GlobalRelationshipsView from "../../characters/relationships/GlobalRelationshipsView";
import RelationshipsTab from "../../characters/relationships/RelationshipsTab";
import AssetPicker from "../../media/AssetPicker";
import PortraitEditor, { type CharacterImageDescription } from "../../media/PortraitEditor";
import SubjectNotes from "../../notes/SubjectNotes";
import AssistantRow from "../AssistantRow";
import HealthCard from "../HealthCard";
import ConfirmDelete from "../ConfirmDelete";
import EntitySheet, { Badge, SheetCard } from "../EntitySheet";
import FieldList from "../FieldList";
import LorebookList from "../LorebookList";
import { useLoreSelection } from "../useLoreSelection";
import {
  ArcMilestones,
  Attributes,
  DiscoveryNotes,
  InterviewPrompts,
  Traits,
} from "../character/CharacterParts";
import styles from "../Lorebook.module.css";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "dialogue", label: "Dialogue" },
  { id: "arc", label: "Arc journey" },
  { id: "relationships", label: "Relationships" },
];

const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Characters in the Lorebook (doc 12 P2). With nobody open, the whole cast: how they relate,
 * as a list or a graph. Open someone and it is the same sheet as every other entry, with the
 * four views the character sheet always had.
 */
export default function CharactersSection() {
  const { characters, upsertCharacter, removeCharacter, sceneCast, structure, activeTemplate } =
    useStoryStore();
  const openEntity = usePanelStore((s) => s.openEntity);
  const resumeSession = useAIStore((s) => s.resumeSession);
  const aiAvailable = useAIAvailable();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { storyId, selectedId, select } = useLoreSelection(
    "characters",
    characters.map((c) => c.id),
    false,
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [interviewing, setInterviewing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [depth, setDepth] = useState(false);
  const [portraitDesc, setPortraitDesc] = useState<CharacterImageDescription | null>(null);
  const [castView, setCastView] = useState<"relationships" | "graph">("relationships");

  const character = characters.find((c) => c.id === selectedId) ?? null;
  const view = VIEWS.some((v) => v.id === params.get("tab")) ? params.get("tab")! : "overview";
  const total = sceneLeaves(structure, activeTemplate).length;
  const scenes = character ? scenesWith("character", character.id, sceneCast, structure, activeTemplate) : [];

  async function save(patch: Partial<Character>) {
    if (!character) return;
    upsertCharacter(await api.updateCharacter(character.id, patch));
  }

  async function interviewStarted(interview: Interview) {
    if (!character) return;
    setInterviewing(false);
    await resumeSession(
      "interview",
      { characterId: character.id, storyId, nodeId: interview.context_node_id ?? undefined },
      interview.id,
      (interview.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      interview.interview_notes ?? undefined,
    );
  }

  const badges = character && (
    <>
      {character.role && <Badge>{label(character.role)}</Badge>}
      {character.character_type && <Badge title="Character type">{label(character.character_type)}</Badge>}
      {character.pronouns && <Badge>{character.pronouns}</Badge>}
      {character.jungian_archetype && (
        <Badge title="Jungian archetype">{label(character.jungian_archetype)}</Badge>
      )}
      {character.narrative_archetype && (
        <Badge title="Narrative archetype">{label(character.narrative_archetype)}</Badge>
      )}
    </>
  );

  return (
    <div className={styles.section}>
      <LorebookList
        title="Characters"
        items={characters.map((c) => ({
          id: c.id,
          name: c.name,
          sub: c.role ? label(c.role) : undefined,
          dot: slotVar(c.color_slot),
        }))}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        onAdd={() => setCreating(true)}
        empty={<p className={styles.listEmpty}>No characters yet. Who is this story about?</p>}
        footer={
          characters.length > 1 && (
            <div className={styles.listFooter}>
              <button
                type="button"
                className={styles.quietBtn}
                onClick={() => select(null)}
                aria-pressed={!character}
              >
                <Users size={11} aria-hidden />
                The whole cast
              </button>
            </div>
          )
        }
      />
      <div className={styles.sheetScroll}>
        {character ? (
          <EntitySheet
            key={character.id}
            entityKey={character.id}
            name={character.name}
            dot={slotVar(character.color_slot)}
            slot={{ value: character.color_slot, onChange: (color_slot) => void save({ color_slot }) }}
            badges={badges}
            alsoCalled={{ names: character.aliases ?? [], onChange: (aliases) => void save({ aliases }) }}
            presence={presenceLine(scenes, total)}
            scenes={scenes}
            onOpenBeside={() => openEntity("character", character.id, character.name)}
            views={VIEWS}
            view={view}
            onView={(id) => setParams(id === "overview" ? {} : { tab: id }, { replace: true })}
            more={[
              { label: "Edit name, role, pronouns…", icon: Pencil, onSelect: () => setEditing(true) },
              ...(aiAvailable
                ? [
                    {
                      label: character.narrative_intent_hidden
                        ? "Show narrative intent in interviews"
                        : "Hide narrative intent from interviews",
                      icon: character.narrative_intent_hidden ? Eye : EyeOff,
                      ai: true,
                      onSelect: () =>
                        void save({ narrative_intent_hidden: !character.narrative_intent_hidden }),
                    },
                  ]
                : []),
              {
                label: "Delete character",
                icon: Trash2,
                danger: true,
                onSelect: () => setDeleting(character),
              },
            ]}
            side={
              view === "overview" ? (
                <>
                  <HealthCard anchor="character_id" id={character.id} storyId={storyId} />
                  <SheetCard title="Portrait">
                    <PortraitEditor
                      storyId={storyId}
                      objectType="character"
                      objectId={character.id}
                      placeholder={<User size={28} />}
                      onAnalyzeForCharacter={setPortraitDesc}
                    />
                  </SheetCard>
                  <SheetCard
                    title="Arc"
                    meta={
                      character.arc_milestones?.length
                        ? `${character.arc_milestones.filter((m) => m.completed).length} of ${character.arc_milestones.length}`
                        : undefined
                    }
                  >
                    <ArcMilestones character={character} onSaved={upsertCharacter} />
                  </SheetCard>
                  <SheetCard title="Notes and questions">
                    <SubjectNotes
                      storyId={storyId}
                      aboutType="character"
                      aboutId={character.id}
                      name={character.name}
                    />
                  </SheetCard>
                  <AIOnly>
                    <SheetCard title="Interview prompts" tone="ai">
                      <InterviewPrompts
                        character={character}
                        onSaved={upsertCharacter}
                        onStart={() => setInterviewing(true)}
                      />
                    </SheetCard>
                  </AIOnly>
                </>
              ) : undefined
            }
            footer={
              view === "overview" ? (
                <>
                  {portraitDesc && (
                    <PortraitDescription desc={portraitDesc} onClose={() => setPortraitDesc(null)} />
                  )}
                  {depth && <CharacterDimensionalityPanel characterId={character.id} />}
                  <AssistantRow
                    actions={[
                      {
                        label: "Interview",
                        title: "Talk to them in their own voice",
                        chat: true,
                        onRun: () => setInterviewing(true),
                      },
                      {
                        label: "Suggest attributes",
                        title: "Traits, backstory, quirks or appearance",
                        onRun: () => setSuggesting(true),
                      },
                      {
                        label: depth ? "Hide character depth" : "Character depth",
                        title: "Dimensionality, contradictions, development",
                        onRun: () => setDepth((d) => !d),
                      },
                    ]}
                  />
                </>
              ) : null
            }
          >
            {view === "overview" && (
              <>
                <FieldList
                  entityKey={character.id}
                  fields={KINDS.character.fields}
                  values={character as unknown as Record<string, unknown>}
                  save={(key, value) => save({ [key]: value } as Partial<Character>)}
                />
                <DiscoveryNotes character={character} onSaved={upsertCharacter} />
                <Traits character={character} onSaved={upsertCharacter} />
                <Attributes character={character} onSaved={upsertCharacter} />
                <AssetPicker storyId={storyId} objectType="character" objectId={character.id} />
              </>
            )}
            {view === "dialogue" && (
              <CharacterDialogueTab characterId={character.id} characterName={character.name} />
            )}
            {view === "arc" && (
              <>
                <ArcTimelineView characterId={character.id} characterName={character.name} />
                <ArcAnalysisPanel characterId={character.id} />
              </>
            )}
            {view === "relationships" && <RelationshipsTab characterId={character.id} storyId={storyId} />}
          </EntitySheet>
        ) : (
          <div className={styles.landing}>
            <div className={styles.landingHeader}>
              <h2 className={styles.landingTitle}>The whole cast</h2>
              {characters.length > 1 && (
                <div className={styles.sheetViews} role="tablist" aria-label="Cast views">
                  {(["relationships", "graph"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={castView === v}
                      className={`${styles.sheetView} ${castView === v ? styles.sheetViewOn : ""}`}
                      onClick={() => setCastView(v)}
                    >
                      {v === "relationships" ? "Relationships" : "Graph"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.landingBody}>
              {characters.length < 2 ? (
                <p className={styles.cardHint}>
                  {characters.length === 0
                    ? "Add your first character with Add."
                    : "Open them from the list. With a second character, how they relate shows here."}
                </p>
              ) : castView === "relationships" ? (
                <GlobalRelationshipsView storyId={storyId} />
              ) : (
                <RelationshipGraph storyId={storyId} />
              )}
            </div>
          </div>
        )}
      </div>

      {creating && (
        <CharacterFormDialog
          storyId={storyId}
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            upsertCharacter(c);
            select(c.id);
          }}
        />
      )}
      {editing && character && (
        <CharacterFormDialog
          storyId={storyId}
          character={character}
          onClose={() => setEditing(false)}
          onSaved={upsertCharacter}
        />
      )}
      {suggesting && character && (
        <AttributeGeneratorDialog character={character} onClose={() => setSuggesting(false)} />
      )}
      {interviewing && character && (
        <StartInterviewDialog
          character={character}
          onStarted={interviewStarted}
          onClose={() => setInterviewing(false)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          name={deleting.name}
          detail="Their relationships, milestones and notes go with them. You can bring them back with Undo."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteCharacter(deleting.id);
            removeCharacter(deleting.id);
            select(null, { replace: true });
            navigate(`/stories/${storyId}/lorebook/characters`, { replace: true });
          }}
        />
      )}
    </div>
  );
}

/** What the Assistant read in a portrait: suggestions to copy, never written in on its own. */
function PortraitDescription({ desc, onClose }: { desc: CharacterImageDescription; onClose: () => void }) {
  const rows: [string, string | string[] | undefined][] = [
    ["Visible in the image", desc.observations],
    ["Appearance", desc.appearance],
    ["Personality", desc.personality],
    ["Voice", desc.voice],
    ["Age", desc.age_estimate],
    ["Worth deciding", desc.questions],
  ];
  return (
    <SheetCard
      title="Portrait description"
      tone="ai"
      meta={
        <button type="button" className={styles.linkBtn} onClick={onClose}>
          Close
        </button>
      }
    >
      {rows
        .filter(([, v]) => v && (!Array.isArray(v) || v.length))
        .map(([k, v]) => (
          <div key={k} className={styles.field}>
            <span className={styles.fieldLabel}>{k}</span>
            <span className={styles.cardHint}>{Array.isArray(v) ? v.join(" · ") : v}</span>
          </div>
        ))}
      <p className={styles.cardHint}>
        Suggestions from the Assistant: copy what is useful into the fields above.
      </p>
    </SheetCard>
  );
}
