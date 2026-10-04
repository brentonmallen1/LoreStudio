import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { slotVar } from "../../lib/colorSlots";
import type { TwistClue, ClueTarget, SubtletyLevel, StructureNode, Twist } from "../../types";
import CommitInput from "../common/CommitInput";
import styles from "./TwistClueEditor.module.css";

interface Props {
  twist: Twist;
  nodes: StructureNode[];
  /** After any change, with the twist as it now stands. */
  onChanged: () => void;
}

const SUBTLETY_OPTIONS: { value: SubtletyLevel; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "subtle", label: "Subtle" },
  { value: "moderate", label: "Moderate" },
  { value: "obvious", label: "Obvious" },
];

/** Each clue is its own row (doc 18 C1): every edit saves that clue, and undoes on its own. */
export default function TwistClueEditor({ twist, nodes, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const clues = twist.clues;

  async function addClue() {
    await api.createClue(twist.id, { subtlety: "subtle" });
    setExpanded(true);
    onChanged();
  }

  async function updateClue(id: string, patch: Partial<TwistClue>) {
    await api.updateClue(id, patch);
    onChanged();
  }

  async function removeClue(id: string) {
    await api.deleteClue(id);
    onChanged();
  }

  return (
    <div
      className={styles.wrap}
      style={{ "--twist-color": slotVar(twist.color_slot) } as React.CSSProperties}
    >
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
                  onCommit={(text) => void updateClue(clue.id, { text })}
                  placeholder="Describe the clue…"
                  aria-label="The clue"
                />
                {clue.quote && <q className={styles.quote}>{clue.quote}</q>}
                <div className={styles.bottomRow}>
                  {/* Points to truth or misdirection */}
                  <div className={styles.directionToggle}>
                    <button
                      type="button"
                      className={`${styles.dirBtn} ${clue.points_to === "truth" ? styles.dirBtnTruth : ""}`}
                      onClick={() => void updateClue(clue.id, { points_to: "truth" as ClueTarget })}
                      title="This clue points toward the truth"
                    >
                      → truth
                    </button>
                    <button
                      type="button"
                      className={`${styles.dirBtn} ${clue.points_to === "misdirection" ? styles.dirBtnMisdirect : ""}`}
                      onClick={() => void updateClue(clue.id, { points_to: "misdirection" as ClueTarget })}
                      title="This clue points toward the misdirection (red herring)"
                    >
                      → misdirect
                    </button>
                  </div>

                  <select
                    className={styles.subtletySelect}
                    value={clue.subtlety}
                    onChange={(e) => void updateClue(clue.id, { subtlety: e.target.value as SubtletyLevel })}
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
                      onChange={(e) => void updateClue(clue.id, { node_id: e.target.value || null })}
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
                onClick={() => void removeClue(clue.id)}
                type="button"
                aria-label="Remove clue"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <button className={styles.addBtn} onClick={() => void addClue()} type="button">
            <Plus size={11} />
            Add clue
          </button>
        </div>
      )}
    </div>
  );
}
