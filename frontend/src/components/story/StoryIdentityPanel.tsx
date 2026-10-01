import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Check, GripVertical, Pencil } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import PerspectiveSummaryPanel from "../analysis/PerspectiveSummaryPanel";
import StorySummaryPanel from "./StorySummaryPanel";
import BeatSheetSelector from "./BeatSheetSelector";
import { SectionCard } from "../common";
import PageHeader from "../layout/PageHeader";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import type { StoryGoal } from "../../types";
import { CharCount, CompletionDots, GroupLabel, HeroStats, WorkshopBtn } from "./StoryIdentityBits";
import styles from "./StoryIdentityPanel.module.css";

const LENGTH_OPTIONS = [
  "",
  "flash_fiction",
  "short_story",
  "novelette",
  "novella",
  "novel",
  "epic_saga",
  "series",
] as const;

const LENGTH_LABELS: Record<string, string> = {
  "": "Not specified",
  flash_fiction: "Flash Fiction (<1K words)",
  short_story: "Short Story (1K–7.5K words)",
  novelette: "Novelette (7.5K–17.5K words)",
  novella: "Novella (17.5K–40K words)",
  novel: "Novel (40K–100K words)",
  epic_saga: "Epic / Saga (100K+ words)",
  series: "Series (multi-book)",
};

// ── Theme tag input ────────────────────────────────────────────────────────
function ThemeInput({ themes, onChange }: { themes: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  function addTheme() {
    const trimmed = input.trim();
    if (!trimmed || themes.includes(trimmed)) return;
    onChange([...themes, trimmed]);
    setInput("");
  }

  return (
    <div className={styles.themeWrap}>
      <div className={styles.tagList}>
        {themes.map((t) => (
          <span key={t} className={styles.tag}>
            {t}
            <button
              className={styles.tagRemove}
              onClick={() => onChange(themes.filter((x) => x !== t))}
              aria-label={`Remove theme ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={styles.tagInputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTheme();
            }
          }}
          placeholder="Add theme… (Enter or comma to add)"
          className={styles.tagInput}
        />
        <button onClick={addTheme} className={styles.tagAddBtn} disabled={!input.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Goals checklist ────────────────────────────────────────────────────────
function GoalsPanel({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory } = useStoryStore();
  const [newGoal, setNewGoal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const goals: StoryGoal[] = activeStory?.goals ?? [];

  async function addGoal() {
    const text = newGoal.trim();
    if (!text || !activeStory) return;
    const updated = await api.addGoal(storyId, text);
    setActiveStory(updated);
    setNewGoal("");
  }

  async function toggleGoal(goalId: string, completed: boolean) {
    if (!activeStory) return;
    const updated = await api.updateGoal(storyId, goalId, { completed: !completed });
    setActiveStory(updated);
  }

  async function removeGoal(goalId: string) {
    if (!activeStory) return;
    const updated = await api.deleteGoal(storyId, goalId);
    setActiveStory(updated);
  }

  function startEdit(goal: StoryGoal) {
    setEditingId(goal.id);
    setEditingText(goal.text);
  }

  async function saveEdit() {
    if (!editingId || !editingText.trim()) {
      setEditingId(null);
      return;
    }
    const updated = await api.updateGoal(storyId, editingId, { text: editingText.trim() });
    setActiveStory(updated);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  function onDragStart(id: string) {
    setDraggedId(id);
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  }

  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const ids = goals.map((g) => g.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);
    setDraggedId(null);
    setDragOverId(null);
    const updated = await api.reorderGoals(storyId, reordered);
    setActiveStory(updated);
  }

  return (
    <>
      <div className={styles.goalList}>
        {goals.length === 0 && <p className={styles.emptyGoals}>No goals yet. Add one below.</p>}
        {goals.map((g) => (
          <div
            key={g.id}
            className={`${styles.goalItem} ${g.completed ? styles.goalDone : ""} ${draggedId === g.id ? styles.goalDragging : ""} ${dragOverId === g.id ? styles.goalDragOver : ""}`}
            draggable
            onDragStart={() => onDragStart(g.id)}
            onDragOver={(e) => onDragOver(e, g.id)}
            onDrop={(e) => onDrop(e, g.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
          >
            <span className={styles.goalDragHandle} title="Drag to reorder">
              <GripVertical size={12} />
            </span>
            <button
              className={styles.goalCheck}
              onClick={() => toggleGoal(g.id, g.completed)}
              aria-label={g.completed ? "Mark incomplete" : "Mark complete"}
            >
              {g.completed ? <Check size={11} /> : null}
            </button>
            {editingId === g.id ? (
              <input
                autoFocus
                className={styles.goalEditInput}
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                onBlur={saveEdit}
              />
            ) : (
              <span className={styles.goalText} onDoubleClick={() => startEdit(g)}>
                {g.text}
              </span>
            )}
            <div className={styles.goalActions}>
              {editingId !== g.id && (
                <button className={styles.goalEditBtn} onClick={() => startEdit(g)} aria-label="Edit goal">
                  <Pencil size={11} />
                </button>
              )}
              <button className={styles.goalDelete} onClick={() => removeGoal(g.id)} aria-label="Delete goal">
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.goalAdd}>
        <input
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGoal()}
          placeholder="Add a goal…"
          className={styles.goalInput}
        />
        <button onClick={addGoal} className={styles.goalAddBtn} disabled={!newGoal.trim()}>
          <Plus size={13} />
        </button>
      </div>
    </>
  );
}

// ── Field count indicator ──────────────────────────────────────────────────
// ── Main panel ─────────────────────────────────────────────────────────────
export default function StoryIdentityPanel({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory, characters } = useStoryStore();
  const navigate = useNavigate();
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fields, setFields] = useState({
    logline: "",
    author_name: "",
    genre: "",
    tone: "",
    intended_length: "",
    narrative_perspective: "",
    pov_character_id: "" as string,
    themes: [] as string[],
    central_conflict: "",
    target_audience: "",
    narrative_intent: "",
    premise: "",
  });

  useEffect(() => {
    if (!activeStory) return;
    setFields({
      logline: activeStory.logline ?? "",
      author_name: activeStory.author_name ?? "",
      genre: activeStory.genre ?? "",
      tone: activeStory.tone ?? "",
      intended_length: activeStory.intended_length ?? "",
      narrative_perspective: activeStory.narrative_perspective ?? "",
      pov_character_id: activeStory.pov_character_id ?? "",
      themes: activeStory.themes ?? [],
      central_conflict: activeStory.central_conflict ?? "",
      target_audience: activeStory.target_audience ?? "",
      narrative_intent: activeStory.narrative_intent ?? "",
      premise: activeStory.premise ?? "",
    });
  }, [activeStory?.id]);

  function scheduleSync(patch: Partial<typeof fields> & { beat_sheet_id?: string | null }) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      const updated = await api.updateStory(storyId, patch);
      setActiveStory(updated);
    }, 900);
  }

  function update(key: keyof typeof fields, value: string | string[]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    scheduleSync({ [key]: value });
  }

  function updatePovCharacter(id: string) {
    setFields((prev) => ({ ...prev, pov_character_id: id }));
    scheduleSync({ pov_character_id: id || null } as Parameters<typeof scheduleSync>[0]);
  }

  async function handleInjectBeatSheet(beatSheetId: string) {
    const result = await api.injectBeatSheet(storyId, beatSheetId);
    navigate(`plan?tab=${result.id}`);
  }

  function updateBeatSheet(id: string | null) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      const updated = await api.updateStory(storyId, { beat_sheet_id: id });
      setActiveStory(updated);
    }, 300);
  }

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  function toggle(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!activeStory) return null;

  // Completion tracking for section badges
  const foundationFields = [fields.logline, fields.premise].filter(Boolean).length;
  const goalsTotal = (activeStory.goals ?? []).length;
  const goalsComplete = (activeStory.goals ?? []).filter((g) => g.completed).length;

  return (
    <div className={styles.panel}>
      <PageHeader
        title="Story identity"
        summary={<HeroStats storyId={storyId} />}
        aside={<AIFeatureInfoTrigger pageId="story-identity" />}
      />

      <div className={styles.scrollArea}>
        {/* ── Foundation ── */}
        <GroupLabel label="Foundation" description="What is this story?" />

        <SectionCard
          title="Core identity"
          collapsed={!!collapsed.identity}
          onToggle={() => toggle("identity")}
          badge={foundationFields > 0 ? <CompletionDots filled={foundationFields} total={2} /> : undefined}
        >
          <div>
            <div className={styles.fieldLabelRow}>
              <p className={styles.subFieldLabel}>Logline</p>
              <WorkshopBtn
                label="Workshop logline"
                message="I want to work on my logline."
                storyId={storyId}
              />
            </div>
            <p className={styles.fieldHint}>
              One sentence: who wants what, against what obstacle, with what at stake.
            </p>
            <p className={styles.fieldPattern}>[Protagonist] must [goal] despite [obstacle], or [stakes]</p>
            <textarea
              value={fields.logline}
              onChange={(e) => update("logline", e.target.value)}
              placeholder="Elena must find the lighthouse keeper before…"
              className={styles.textarea}
              rows={2}
            />
            <div className={styles.fieldMeta}>
              <CharCount value={fields.logline} max={150} />
            </div>
          </div>
          <div>
            <p className={styles.subFieldLabel}>Author byline</p>
            <p className={styles.fieldHint}>
              Shown on the title page of exports. Leave blank to export without one.
            </p>
            <input
              value={fields.author_name}
              onChange={(e) => update("author_name", e.target.value)}
              placeholder="Pen name or real name"
              className={styles.input}
            />
          </div>
          <div>
            <p className={styles.subFieldLabel}>Premise</p>
            <p className={styles.fieldHint}>
              Expanded setup: the situation, the characters, and what's at stake.
            </p>
            <p className={styles.fieldPattern}>
              In [setting], [protagonist with flaw] faces [problem] when [inciting incident]…
            </p>
            <textarea
              value={fields.premise}
              onChange={(e) => update("premise", e.target.value)}
              placeholder="In a remote lighthouse station…"
              className={styles.textarea}
              rows={3}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Narrative intent"
          collapsed={!!collapsed.intent}
          onToggle={() => toggle("intent")}
        >
          <div className={styles.fieldLabelRow}>
            <WorkshopBtn
              label="Workshop intent"
              message="I'm trying to figure out what my story is really about. Help me think through my narrative intent."
              storyId={storyId}
            />
          </div>
          <p className={styles.fieldHint}>
            What is this story about (meaning, not plot)? What question does it ask? What should the reader
            feel at the end?
          </p>
          <textarea
            value={fields.narrative_intent}
            onChange={(e) => update("narrative_intent", e.target.value)}
            placeholder="This story asks whether redemption is possible when…"
            className={styles.textarea}
            rows={3}
          />
        </SectionCard>

        {/* ── Voice ── */}
        <GroupLabel label="Voice" description="How is it told?" />

        <SectionCard title="Style" collapsed={!!collapsed.style} onToggle={() => toggle("style")}>
          <div className={styles.row}>
            <div>
              <p className={styles.subFieldLabel}>Genre</p>
              <input
                value={fields.genre}
                onChange={(e) => update("genre", e.target.value)}
                placeholder="Literary fiction, thriller…"
                className={styles.input}
              />
            </div>
            <div>
              <p className={styles.subFieldLabel}>Tone</p>
              <input
                value={fields.tone}
                onChange={(e) => update("tone", e.target.value)}
                placeholder="Dark, hopeful, satirical…"
                className={styles.input}
              />
            </div>
          </div>
          <div>
            <p className={styles.subFieldLabel}>Narrative Perspective</p>
            <p className={styles.fieldHint}>
              Point of view for the story. Guides AI tools on voice and perspective.
            </p>
            <select
              value={fields.narrative_perspective}
              onChange={(e) => update("narrative_perspective", e.target.value)}
              className={styles.input}
            >
              <option value="">Not specified</option>
              <option value="first_person">First Person</option>
              <option value="third_limited">Third Person Limited</option>
              <option value="third_omniscient">Third Person Omniscient</option>
              <option value="second_person">Second Person</option>
              <option value="multiple_pov">Multiple POV</option>
            </select>
            {(fields.narrative_perspective === "first_person" ||
              fields.narrative_perspective === "third_limited") && (
              <div className={styles.subField}>
                <p className={styles.subFieldLabel}>POV Character</p>
                <select
                  value={fields.pov_character_id}
                  onChange={(e) => updatePovCharacter(e.target.value)}
                  className={styles.input}
                >
                  <option value="">Not specified</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Form ── */}
        <GroupLabel label="Form" description="What shape does it take?" />

        <SectionCard title="Structure" collapsed={!!collapsed.structure} onToggle={() => toggle("structure")}>
          <div>
            <p className={styles.subFieldLabel}>Intended Length</p>
            <p className={styles.fieldHint}>
              Target form and word count range. Used by Findings, Numbers and the Assistant.
            </p>
            <select
              value={fields.intended_length}
              onChange={(e) => update("intended_length", e.target.value)}
              className={styles.input}
            >
              {LENGTH_OPTIONS.map((val) => (
                <option key={val} value={val}>
                  {LENGTH_LABELS[val]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className={styles.subFieldLabel}>Beat Sheet</p>
            <p className={styles.fieldHint}>
              Optional story structure framework. Helps track where key beats fall relative to your word
              count.
            </p>
            <BeatSheetSelector
              value={activeStory.beat_sheet_id}
              onChange={updateBeatSheet}
              onInject={handleInjectBeatSheet}
            />
          </div>
        </SectionCard>

        {/* ── Substance ── */}
        <GroupLabel label="Substance" description="What's it really about?" />

        <SectionCard
          title="Themes and conflict"
          collapsed={!!collapsed.themes}
          onToggle={() => toggle("themes")}
        >
          <div>
            <div className={styles.fieldLabelRow}>
              <p className={styles.subFieldLabel}>Themes</p>
              <WorkshopBtn
                label="Explore themes"
                message="I want to explore the themes in my story."
                storyId={storyId}
              />
            </div>
            <p className={styles.fieldHint}>Recurring ideas and motifs. Press Enter or comma to add.</p>
            <ThemeInput themes={fields.themes} onChange={(t) => update("themes", t)} />
          </div>
          <div>
            <div className={styles.fieldLabelRow}>
              <p className={styles.subFieldLabel}>Central Conflict</p>
              <WorkshopBtn
                label="Workshop conflict"
                message="Help me think through my central conflict."
                storyId={storyId}
              />
            </div>
            <p className={styles.fieldPattern}>
              [Character]'s need for [want] vs. [opposing force or internal flaw]
            </p>
            <textarea
              value={fields.central_conflict}
              onChange={(e) => update("central_conflict", e.target.value)}
              placeholder="Eleanor's need to protect her carefully constructed isolation versus…"
              className={styles.textarea}
              rows={2}
            />
          </div>
          <div>
            <p className={styles.subFieldLabel}>Target Audience</p>
            <select
              value={fields.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
              className={styles.input}
            >
              <option value="">Not specified</option>
              <option value="kids">Kids (6–8)</option>
              <option value="middle_grade">Middle Grade (8–12)</option>
              <option value="young_adult">Young Adult (12–18)</option>
              <option value="new_adult">New Adult (18–25)</option>
              <option value="adult">Adult</option>
            </select>
          </div>
        </SectionCard>

        {/* ── Compass ── */}
        <GroupLabel label="Compass" description="Where are you going?" />

        <SectionCard
          title="Story goals"
          collapsed={!!collapsed.goals}
          onToggle={() => toggle("goals")}
          badge={
            goalsTotal > 0 ? (
              <span className={styles.goalsBadge}>
                {goalsComplete}/{goalsTotal}
              </span>
            ) : undefined
          }
        >
          <p className={styles.fieldHint}>
            Explicit goals to hit as you write. Drag to reorder, double-click to edit.
          </p>
          <GoalsPanel storyId={storyId} />
        </SectionCard>

        <StorySummaryPanel storyId={storyId} />
        <PerspectiveSummaryPanel storyId={storyId} />
      </div>
    </div>
  );
}
