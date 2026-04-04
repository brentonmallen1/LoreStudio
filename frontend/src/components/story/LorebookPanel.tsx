import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import PerspectiveSummaryPanel from "../analysis/PerspectiveSummaryPanel";
import StorySummaryPanel from "./StorySummaryPanel";
import BeatSheetSelector from "./BeatSheetSelector";
import styles from "./LorebookPanel.module.css";

const LENGTH_OPTIONS = ["", "flash_fiction", "short_story", "novelette", "novella", "novel", "epic_saga", "series"] as const;

const LENGTH_LABELS: Record<string, string> = {
  "": "Not specified",
  "flash_fiction": "Flash Fiction (<1K words)",
  "short_story": "Short Story (1K–7.5K words)",
  "novelette": "Novelette (7.5K–17.5K words)",
  "novella": "Novella (17.5K–40K words)",
  "novel": "Novel (40K–100K words)",
  "epic_saga": "Epic / Saga (100K+ words)",
  "series": "Series (multi-book)",
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
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Story Goals</h3>
      <p className={styles.fieldHint}>Explicit goals to hit as you write. Check them off as you accomplish them.</p>
      <div className={styles.goalList}>
        {goals.length === 0 && (
          <p className={styles.emptyGoals}>No goals yet. Add one below.</p>
        )}
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
            <button
              className={styles.goalDelete}
              onClick={() => removeGoal(g.id)}
              aria-label="Delete goal"
            >
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
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────
export default function LorebookPanel({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory } = useStoryStore();
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fields, setFields] = useState({
    logline: "",
    genre: "",
    tone: "",
    intended_length: "",
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

  function updateBeatSheet(id: string | null) {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      const updated = await api.updateStory(storyId, { beat_sheet_id: id });
      setActiveStory(updated);
    }, 300);
  }

  if (!activeStory) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Lorebook</h2>
        <p className={styles.panelSubtitle}>Reference and grounding for your story. Auto-saves as you type.</p>
      </div>

      <div className={styles.scrollArea}>
        {/* ── Logline ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Logline</h3>
          <p className={styles.fieldHint}>One sentence: who wants what, against what obstacle, with what at stake.</p>
          <input
            value={fields.logline}
            onChange={(e) => update("logline", e.target.value)}
            placeholder="A disgraced detective must…"
            className={styles.input}
          />
        </div>

        {/* ── Premise ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Premise</h3>
          <p className={styles.fieldHint}>Expanded setup: the situation, the characters, and what's at stake.</p>
          <textarea
            value={fields.premise}
            onChange={(e) => update("premise", e.target.value)}
            placeholder="In a world where…"
            className={styles.textarea}
            rows={3}
          />
        </div>

        {/* ── Narrative Intent ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Narrative Intent</h3>
          <p className={styles.fieldHint}>What is this story about (meaning, not plot)? What question does it ask? What should the reader feel at the end?</p>
          <textarea
            value={fields.narrative_intent}
            onChange={(e) => update("narrative_intent", e.target.value)}
            placeholder="This story asks whether redemption is possible when…"
            className={styles.textarea}
            rows={3}
          />
        </div>

        {/* ── Genre + Tone ── */}
        <div className={styles.row}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Genre</h3>
            <input
              value={fields.genre}
              onChange={(e) => update("genre", e.target.value)}
              placeholder="Literary fiction, thriller…"
              className={styles.input}
            />
          </div>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Tone</h3>
            <input
              value={fields.tone}
              onChange={(e) => update("tone", e.target.value)}
              placeholder="Dark, hopeful, satirical…"
              className={styles.input}
            />
          </div>
        </div>

        {/* ── Intended Length ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Intended Length</h3>
          <p className={styles.fieldHint}>Target form and word count range for your story. Used by Story Health and AI tools.</p>
          <select
            value={fields.intended_length}
            onChange={(e) => update("intended_length", e.target.value)}
            className={styles.input}
          >
            {LENGTH_OPTIONS.map((val) => (
              <option key={val} value={val}>{LENGTH_LABELS[val]}</option>
            ))}
          </select>
        </div>

        {/* ── Beat Sheet ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Beat Sheet</h3>
          <p className={styles.fieldHint}>Optional story structure framework. Helps track where key beats fall relative to your word count.</p>
          <BeatSheetSelector
            value={activeStory.beat_sheet_id}
            onChange={updateBeatSheet}
          />
        </div>

        {/* ── Themes ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Themes</h3>
          <p className={styles.fieldHint}>Recurring ideas and motifs. Press Enter or comma to add.</p>
          <ThemeInput
            themes={fields.themes}
            onChange={(t) => update("themes", t)}
          />
        </div>

        {/* ── Central Conflict ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Central Conflict</h3>
          <textarea
            value={fields.central_conflict}
            onChange={(e) => update("central_conflict", e.target.value)}
            placeholder="The core tension driving the story…"
            className={styles.textarea}
            rows={2}
          />
        </div>

        {/* ── Audience ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Target Audience</h3>
          <input
            value={fields.target_audience}
            onChange={(e) => update("target_audience", e.target.value)}
            placeholder="Adult literary fiction readers…"
            className={styles.input}
          />
        </div>

        {/* ── Goals ── */}
        <GoalsPanel storyId={storyId} />

        {/* ── Story So Far ── */}
        <div className={styles.section}>
          <StorySummaryPanel storyId={storyId} />
        </div>

        {/* ── Perspective Summaries ── */}
        <div className={styles.section}>
          <PerspectiveSummaryPanel storyId={storyId} />
        </div>
      </div>
    </div>
  );
}
