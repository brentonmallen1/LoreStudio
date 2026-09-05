import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Check } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import PerspectiveSummaryPanel from "../analysis/PerspectiveSummaryPanel";
import StorySummaryPanel from "./StorySummaryPanel";
import BeatSheetSelector from "./BeatSheetSelector";
import { SectionCard } from "../common";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import styles from "./LorebookPanel.module.css";

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

// ── Theme tag input ────────────────────────────────────────────────────
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
          placeholder="Add theme…"
          className={styles.tagInput}
        />
        <button onClick={addTheme} className={styles.tagAddBtn} disabled={!input.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Goals checklist ────────────────────────────────────────────────────
function GoalsPanel({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory } = useStoryStore();
  const [newGoal, setNewGoal] = useState("");
  const goals = activeStory?.goals ?? [];

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

  return (
    <>
      <div className={styles.goalList}>
        {goals.length === 0 && <p className={styles.emptyGoals}>No goals yet. Add one below.</p>}
        {goals.map((g) => (
          <div key={g.id} className={`${styles.goalItem} ${g.completed ? styles.goalDone : ""}`}>
            <button
              className={styles.goalCheck}
              onClick={() => toggleGoal(g.id, g.completed)}
              aria-label={g.completed ? "Mark incomplete" : "Mark complete"}
            >
              {g.completed ? <Check size={11} /> : null}
            </button>
            <span className={styles.goalText}>{g.text}</span>
            <button className={styles.goalDelete} onClick={() => removeGoal(g.id)} aria-label="Delete goal">
              <Trash2 size={11} />
            </button>
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

// ── Main panel ─────────────────────────────────────────────────────────
export default function LorebookPanel({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory, characters } = useStoryStore();
  const navigate = useNavigate();
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fields, setFields] = useState({
    logline: "",
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

  // Sync local state when story loads
  useEffect(() => {
    if (!activeStory) return;
    setFields({
      logline: activeStory.logline ?? "",
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
    navigate(`outline?tab=${result.id}`);
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

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleRow}>
          <h2 className={styles.panelTitle}>Lorebook</h2>
          <AIFeatureInfoTrigger pageId="lorebook" />
        </div>
        <p className={styles.panelSubtitle}>
          Reference and grounding for your story. Auto-saves as you type.
        </p>
      </div>

      <div className={styles.scrollArea}>
        {/* ── Core Identity ── */}
        <SectionCard
          title="Core Identity"
          variant="accent"
          collapsed={!!collapsed.identity}
          onToggle={() => toggle("identity")}
        >
          <div>
            <p className={styles.subFieldLabel}>Logline</p>
            <p className={styles.fieldHint}>
              One sentence: who wants what, against what obstacle, with what at stake.
            </p>
            <input
              value={fields.logline}
              onChange={(e) => update("logline", e.target.value)}
              placeholder="A disgraced detective must…"
              className={styles.input}
            />
          </div>
          <div>
            <p className={styles.subFieldLabel}>Premise</p>
            <p className={styles.fieldHint}>
              Expanded setup: the situation, the characters, and what's at stake.
            </p>
            <textarea
              value={fields.premise}
              onChange={(e) => update("premise", e.target.value)}
              placeholder="In a world where…"
              className={styles.textarea}
              rows={3}
            />
          </div>
        </SectionCard>

        {/* ── Narrative Intent ── */}
        <SectionCard
          title="Narrative Intent"
          variant="intent"
          collapsed={!!collapsed.intent}
          onToggle={() => toggle("intent")}
        >
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

        {/* ── Style ── */}
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

        {/* ── Structure ── */}
        <SectionCard title="Structure" collapsed={!!collapsed.structure} onToggle={() => toggle("structure")}>
          <div>
            <p className={styles.subFieldLabel}>Intended Length</p>
            <p className={styles.fieldHint}>
              Target form and word count range. Used by Story Health and AI tools.
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

        {/* ── Themes & Conflict ── */}
        <SectionCard
          title="Themes & Conflict"
          collapsed={!!collapsed.themes}
          onToggle={() => toggle("themes")}
        >
          <div>
            <p className={styles.subFieldLabel}>Themes</p>
            <p className={styles.fieldHint}>Recurring ideas and motifs. Press Enter or comma to add.</p>
            <ThemeInput themes={fields.themes} onChange={(t) => update("themes", t)} />
          </div>
          <div>
            <p className={styles.subFieldLabel}>Central Conflict</p>
            <textarea
              value={fields.central_conflict}
              onChange={(e) => update("central_conflict", e.target.value)}
              placeholder="The core tension driving the story…"
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

        {/* ── Story Goals ── */}
        <SectionCard title="Story Goals" collapsed={!!collapsed.goals} onToggle={() => toggle("goals")}>
          <p className={styles.fieldHint}>
            Explicit goals to hit as you write. Check them off as you accomplish them.
          </p>
          <GoalsPanel storyId={storyId} />
        </SectionCard>

        {/* AI summaries are self-contained cards — render directly without wrapping */}
        <StorySummaryPanel storyId={storyId} />
        <PerspectiveSummaryPanel storyId={storyId} />
      </div>
    </div>
  );
}
