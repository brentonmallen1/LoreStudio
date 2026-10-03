import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TwistClue, ClueTarget, SubtletyLevel, StructureNode } from "../../types";
import CommitInput from "../common/CommitInput";
import styles from "./TwistClueEditor.module.css";

interface Props {
  clues: TwistClue[];
  nodes: StructureNode[];
  onChange: (clues: TwistClue[]) => void;
}

const SUBTLETY_OPTIONS: { value: SubtletyLevel; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "subtle", label: "Subtle" },
  { value: "moderate", label: "Moderate" },
  { value: "obvious", label: "Obvious" },
];

function newClue(): TwistClue {
  return {
    id: crypto.randomUUID(),
    node_id: null,
    text: "",
    points_to: "truth",
    subtlety: "subtle",
  };
}

export default function TwistClueEditor({ clues, nodes, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  function addClue() {
    onChange([...clues, newClue()]);
    setExpanded(true);
  }

  function updateClue(id: string, patch: Partial<TwistClue>) {
    onChange(clues.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeClue(id: string) {
    onChange(clues.filter((c) => c.id !== id));
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setExpanded((v) => !v)} type="button">
        <span className={styles.toggleLabel}>
          Clues
          {clues.length > 0 && <span className={styles.count}>{clues.length}</span>}
        </span>
        <span className={styles.chevron}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {clues.length === 0 && (
            <p className={styles.empty}>
              No clues yet. Add hints you've planted (or plan to plant) in the story.
            </p>
          )}
          {clues.map((clue) => (
            <div key={clue.id} className={styles.clueRow}>
              <div className={styles.clueFields}>
                <CommitInput
                  className={styles.textInput}
                  value={clue.text}
                  onCommit={(text) => updateClue(clue.id, { text })}
                  placeholder="Describe the clue…"
                  aria-label="The clue"
                />
                <div className={styles.bottomRow}>
                  {/* Points to truth or misdirection */}
                  <div className={styles.directionToggle}>
                    <button
                      type="button"
                      className={`${styles.dirBtn} ${clue.points_to === "truth" ? styles.dirBtnTruth : ""}`}
                      onClick={() => updateClue(clue.id, { points_to: "truth" as ClueTarget })}
                      title="This clue points toward the truth"
                    >
                      → truth
                    </button>
                    <button
                      type="button"
                      className={`${styles.dirBtn} ${clue.points_to === "misdirection" ? styles.dirBtnMisdirect : ""}`}
                      onClick={() => updateClue(clue.id, { points_to: "misdirection" as ClueTarget })}
                      title="This clue points toward the misdirection (red herring)"
                    >
                      → misdirect
                    </button>
                  </div>

                  <select
                    className={styles.subtletySelect}
                    value={clue.subtlety}
                    onChange={(e) => updateClue(clue.id, { subtlety: e.target.value as SubtletyLevel })}
                  >
                    {SUBTLETY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {nodes.length > 0 && (
                    <select
                      className={styles.nodeSelect}
                      value={clue.node_id ?? ""}
                      onChange={(e) => updateClue(clue.id, { node_id: e.target.value || null })}
                    >
                      <option value="">No scene</option>
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title || `Untitled ${n.level_type}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <button
                className={styles.removeBtn}
                onClick={() => removeClue(clue.id)}
                type="button"
                aria-label="Remove clue"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <button className={styles.addBtn} onClick={addClue} type="button">
            <Plus size={11} />
            Add clue
          </button>
        </div>
      )}
    </div>
  );
}
