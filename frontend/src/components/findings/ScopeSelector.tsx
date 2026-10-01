import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { StructureNode } from "../../types";
import styles from "./ScopeSelector.module.css";

export type ScopeType = "story" | "chapters" | "scenes";

export interface ScopeSelection {
  type: ScopeType;
  ids: string[];
}

interface Props {
  structure: StructureNode[];
  value: ScopeSelection;
  onChange: (scope: ScopeSelection) => void;
}

export function ScopeSelector({ structure, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Top-level nodes (no parent = acts/parts) and second-level (chapters/scenes)
  const topLevel = structure.filter((n) => !n.parent_id);
  const secondLevel = structure.filter((n) => n.parent_id && topLevel.some((t) => t.id === n.parent_id));
  // Leaf nodes with content
  const leaves = structure.filter((n) => !structure.some((c) => c.parent_id === n.id) && n.content);

  function toggleId(id: string, type: ScopeType) {
    const current = value.type === type ? value.ids : [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ type: next.length === 0 ? "story" : type, ids: next });
  }

  const scopeLabel =
    value.type === "story"
      ? "Whole story"
      : `${value.ids.length} ${value.type === "chapters" ? "chapter" : "scene"}${value.ids.length !== 1 ? "s" : ""}`;

  return (
    <div className={styles.root}>
      <label className={styles.label}>Scope</label>
      <button className={styles.trigger} onClick={() => setExpanded((s) => !s)}>
        <span>{scopeLabel}</span>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {expanded && (
        <div className={styles.panel}>
          <button
            className={`${styles.scopeOption} ${value.type === "story" ? styles.scopeOptionActive : ""}`}
            onClick={() => {
              onChange({ type: "story", ids: [] });
              setExpanded(false);
            }}
          >
            Whole story
          </button>

          {(secondLevel.length > 0 || leaves.length > 0) && (
            <>
              <div className={styles.groupLabel}>Chapters / sections</div>
              {(secondLevel.length > 0 ? secondLevel : topLevel).map((n) => (
                <label key={n.id} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={value.type === "chapters" && value.ids.includes(n.id)}
                    onChange={() => toggleId(n.id, "chapters")}
                  />
                  <span className={styles.checkLabel}>{n.title || "Untitled"}</span>
                </label>
              ))}

              {leaves.length > 0 && (
                <>
                  <div className={styles.groupLabel}>Individual scenes</div>
                  {leaves.map((n) => (
                    <label key={n.id} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={value.type === "scenes" && value.ids.includes(n.id)}
                        onChange={() => toggleId(n.id, "scenes")}
                      />
                      <span className={styles.checkLabel}>{n.title || "Untitled"}</span>
                    </label>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
