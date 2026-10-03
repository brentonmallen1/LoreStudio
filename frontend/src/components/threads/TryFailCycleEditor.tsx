import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TryFailCycle, TryFailOutcome, StructureNode } from "../../types";
import CommitInput from "../common/CommitInput";
import styles from "./TryFailCycleEditor.module.css";

interface Props {
  cycles: TryFailCycle[];
  nodes: StructureNode[];
  onChange: (cycles: TryFailCycle[]) => void;
}

const OUTCOMES: { value: TryFailOutcome; label: string; hint: string }[] = [
  { value: "fail_disaster", label: "Fail: Disaster", hint: "Fails and makes things worse" },
  { value: "fail_setback", label: "Fail: Setback", hint: "Fails but doesn't worsen things" },
  { value: "success_cost", label: "Success: With Cost", hint: "Succeeds but at a price" },
  { value: "success_clean", label: "Success: Clean", hint: "Succeeds without cost" },
];

function newCycle(): TryFailCycle {
  return {
    id: crypto.randomUUID(),
    description: "",
    outcome: "fail_disaster",
    node_id: null,
  };
}

export default function TryFailCycleEditor({ cycles, nodes, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  function addCycle() {
    onChange([...cycles, newCycle()]);
    setExpanded(true);
  }

  function updateCycle(id: string, patch: Partial<TryFailCycle>) {
    onChange(cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCycle(id: string) {
    onChange(cycles.filter((c) => c.id !== id));
  }

  const cycleCount = cycles.length;

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={() => setExpanded((v) => !v)} type="button">
        <span className={styles.toggleLabel}>
          Try/Fail cycles
          {cycleCount > 0 && <span className={styles.count}>{cycleCount}</span>}
        </span>
        <span className={styles.chevron}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {cycleCount === 0 && (
            <p className={styles.empty}>No cycles yet. Track protagonist attempts before the climax.</p>
          )}
          {cycles.map((cycle, i) => (
            <div key={cycle.id} className={styles.cycleRow}>
              <span className={styles.cycleNum}>{i + 1}</span>
              <div className={styles.cycleFields}>
                <CommitInput
                  className={styles.descInput}
                  value={cycle.description}
                  onCommit={(description) => updateCycle(cycle.id, { description })}
                  placeholder="What does the protagonist attempt?"
                  aria-label="The attempt"
                />
                <div className={styles.bottomRow}>
                  <select
                    className={styles.outcomeSelect}
                    value={cycle.outcome}
                    onChange={(e) => updateCycle(cycle.id, { outcome: e.target.value as TryFailOutcome })}
                    title={OUTCOMES.find((o) => o.value === cycle.outcome)?.hint}
                  >
                    {OUTCOMES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {nodes.length > 0 && (
                    <select
                      className={styles.nodeSelect}
                      value={cycle.node_id ?? ""}
                      onChange={(e) => updateCycle(cycle.id, { node_id: e.target.value || null })}
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
                onClick={() => removeCycle(cycle.id)}
                type="button"
                aria-label="Remove cycle"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <button className={styles.addBtn} onClick={addCycle} type="button">
            <Plus size={11} />
            Add cycle
          </button>
        </div>
      )}
    </div>
  );
}
