import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Pencil, SpellCheck, Trash2, User, Users } from "lucide-react";
import { api } from "../../../api/client";
import { CHARACTER_QUESTIONS, KINDS } from "../../../lib/lorebook/kinds";
import { presenceLine, scenesWith } from "../../../lib/lorebook/presence";
import { sceneLeaves } from "../../../lib/planning/methods";
import { slotVar } from "../../../lib/colorSlots";
import { useAIAvailable } from "../../../lib/mode";
import { useAIStore } from "../../../stores/aiStore";
import { usePanelStore } from "../../../stores/panelStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { Character, Interview } from "../../../types";
import AIOnly from "../../ai/AIOnly";
import ArcTimelineView from "../../characters/ArcTimelineView";
import AttributeGeneratorDialog from "../../characters/AttributeGeneratorDialog";
import CharacterDialogueTab from "../../characters/CharacterDialogueTab";
import CharacterFormDialog from "../../characters/CharacterFormDialog";
import ManuscriptReview from "../../characters/ManuscriptReview";
import RelationshipGraph from "../../characters/RelationshipGraph";
import StartInterviewDialog from "../../characters/StartInterviewDialog";
import GlobalRelationshipsView from "../../characters/relationships/GlobalRelationshipsView";
import RelationshipsTab from "../../characters/relationships/RelationshipsTab";
import AssetPicker from "../../media/AssetPicker";
import PortraitEditor from "../../media/PortraitEditor";
import { announceKept } from "../../../lib/ai/keptEvents";
import SubjectNotes from "../../notes/SubjectNotes";
import HealthCard from "../HealthCard";
import ConfirmDelete from "../ConfirmDelete";
import EntitySheet, { Badge, SheetCard } from "../EntitySheet";
import FieldList from "../FieldList";
import LorebookList from "../LorebookList";
import { useLoreSelection } from "../useLoreSelection";
import ArcLine from "../character/ArcLine";
import { ArcMilestones, DiscoveryNotes, InterviewPrompts, Traits } from "../character/CharacterParts";
import ThreeQuestions from "../character/ThreeQuestions";
import WhoAreTheyView from "../character/WhoAreTheyView";
import styles from "../Lorebook.module.css";
import TropesHere from "../../tropes/TropesHere";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "who", label: "Who are they" },
  { id: "dialogue", label: "Dialogue" },
  { id: "arc", label: "Arc journey" },
  { id: "relationships", label: "Relationships" },
];

/** Overview's fields after the three questions (doc 20 P5). */
const OVERVIEW_REST = KINDS.character.fields.filter((f) => !CHARACTER_QUESTIONS.includes(f.key));

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
  const [reviewingPronouns, setReviewingPronouns] = useState(false);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [interviewing, setInterviewing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
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
      {character.gender && <Badge title="Gender">{character.gender}</Badge>}
      {character.pronouns && <Badge>{character.pronouns}</Badge>}
      {character.age && <Badge title="Age">{character.age}</Badge>}
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
        onOpenBeside={(id) => {
          const c = characters.find((x) => x.id === id);
          if (c) openEntity("character", c.id, c.name);
        }}
        onAdd={() => setCreating(true)}
        seriesKinds={["character"]}
        onFromSeries={(id) => select(id)}
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
            series={{ kind: "character", id: character.id }}
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
              ...(character.pronouns
                ? [
                    {
                      label: "Review pronouns…",
                      icon: SpellCheck,
                      onSelect: () => setReviewingPronouns(true),
                    },
                  ]
                : []),
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
                      onAnalyzeForCharacter={() =>
                        announceKept({ storyId, type: "character", id: character.id })
                      }
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
                  <SheetCard title="Tropes">
                    <TropesHere storyId={storyId} place={{ characterId: character.id }} />
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
            assistant={{
              type: "character",
              id: character.id,
              pageId: "character-sheet",
              extra: [
                { id: "session-interview", chat: true, open: () => setInterviewing(true) },
                { id: "character-attributes", open: () => setSuggesting(true) },
              ],
            }}
          >
            {view === "overview" && (
              <>
                <ThreeQuestions
                  character={character}
                  save={(key, value) => save({ [key]: value } as Partial<Character>)}
                />
                <FieldList
                  entityKey={character.id}
                  fields={OVERVIEW_REST}
                  values={character as unknown as Record<string, unknown>}
                  save={(key, value) => save({ [key]: value } as Partial<Character>)}
                />
                <DiscoveryNotes character={character} onSaved={upsertCharacter} />
                <Traits character={character} onSaved={upsertCharacter} />
                <AssetPicker storyId={storyId} objectType="character" objectId={character.id} />
              </>
            )}
            {view === "who" && <WhoAreTheyView character={character} save={save} onSaved={upsertCharacter} />}
            {view === "dialogue" && (
              <CharacterDialogueTab characterId={character.id} characterName={character.name} />
            )}
            {view === "arc" && (
              <>
                <ArcLine character={character} />
                <ArcTimelineView characterId={character.id} characterName={character.name} />
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
      {reviewingPronouns && character && (
        <ManuscriptReview
          character={character}
          storyId={storyId}
          change={null}
          onDone={(c) => {
            upsertCharacter(c);
            setReviewingPronouns(false);
          }}
          onClose={() => setReviewingPronouns(false)}
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
