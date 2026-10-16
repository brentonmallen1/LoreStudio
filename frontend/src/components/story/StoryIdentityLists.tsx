import { useState } from "react";
import { Plus, Trash2, Check, GripVertical, Pencil } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryGoal } from "../../types";
import styles from "./StoryIdentityPanel.module.css";

// The lists on Story identity: its themes, and its goals checklist.

// ── Theme tag input ────────────────────────────────────────────────────────
export function ThemeInput({ themes, onChange }: { themes: string[]; onChange: (t: string[]) => void }) {
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
export function GoalsPanel({ storyId }: { storyId: string }) {
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
        <button
          aria-label="Add the goal"
          onClick={addGoal}
          className={styles.goalAddBtn}
          disabled={!newGoal.trim()}
        >
          <Plus size={13} />
        </button>
      </div>
    </>
  );
}
