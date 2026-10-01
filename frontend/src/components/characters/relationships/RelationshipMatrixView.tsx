import { useState } from "react";
import type { Character, CharacterRelationship } from "../../../types";
import styles from "./RelationshipMatrixView.module.css";

type CellMode = "type" | "purpose" | "trust" | "power" | "affection" | "strength";

const TYPE_COLORS: Record<string, string> = {
  family: "#6b8e6b",
  romantic: "#c97878",
  ally: "#7898c9",
  rival: "#c9a060",
  enemy: "#c96060",
  mentor: "#9878c9",
  confidant: "#78a878",
  authority: "#a8a060",
  foil: "#c9c060",
  protector: "#609878",
  "former ally": "#9890a0",
};

function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? "#888";
}

function safeStrength(rel: CharacterRelationship) {
  const s = rel.strength as Partial<import("../../../types").StrengthDimensions> | null | undefined;
  return {
    trust: s?.trust != null ? Number(s.trust) : 5,
    power: s?.power != null ? Number(s.power) : 5,
    affection: s?.affection != null ? Number(s.affection) : 5,
  };
}

function avgStrength(rel: CharacterRelationship): number {
  const s = safeStrength(rel);
  return (s.trust + s.power + s.affection) / 3;
}

// stored 0–10, where 5 = neutral (display 0). Positive = blue, negative = orange-red.
function strengthColor(stored: number): string {
  const display = stored - 5; // −5..+5
  const t = Math.abs(display) / 5; // 0..1 intensity
  if (display >= 0) {
    // neutral → blue
    const r = Math.round(160 + t * (120 - 160));
    const g = Math.round(160 + t * (152 - 160));
    const b = Math.round(160 + t * (201 - 160));
    return `rgb(${r},${g},${b})`;
  }
  // neutral → orange-red
  const r = Math.round(160 + t * (201 - 160));
  const g = Math.round(160 + t * (96 - 160));
  const b = Math.round(160 + t * (60 - 160));
  return `rgb(${r},${g},${b})`;
}

const PURPOSE_COLORS: Record<string, string> = {
  "conflict-driver": "#c96060",
  ally: "#7898c9",
  foil: "#c9c060",
  "growth-catalyst": "#78a878",
  "emotional-anchor": "#c97878",
  "twist-setup": "#9878c9",
  "comic-relief": "#c9a060",
  "exposition-vehicle": "#a0a060",
  obstacle: "#c06060",
  mirror: "#8890c9",
  "wisdom-source": "#78a8a8",
  "past-connection": "#9890a0",
  "structure-provider": "#a09060",
};

function purposeColor(p: string): string {
  return PURPOSE_COLORS[p] ?? "#888";
}

const MODES: { value: CellMode; label: string }[] = [
  { value: "type", label: "Relationship type" },
  { value: "purpose", label: "Narrative purpose" },
  { value: "strength", label: "Avg strength" },
  { value: "trust", label: "Trust" },
  { value: "power", label: "Power balance" },
  { value: "affection", label: "Affection" },
];

interface Props {
  characters: Character[];
  relationships: CharacterRelationship[];
  onEditRelationship: (rel: CharacterRelationship) => void;
  onCreateRelationship: (fromId: string, toId: string) => void;
  showHidden: boolean;
}

export default function RelationshipMatrixView({
  characters,
  relationships,
  onEditRelationship,
  onCreateRelationship,
  showHidden,
}: Props) {
  const [mode, setMode] = useState<CellMode>("type");

  if (characters.length < 2) {
    return <p className={styles.empty}>Add more characters to see the matrix.</p>;
  }

  function findRel(fromId: string, toId: string) {
    return relationships.find(
      (r) =>
        (r.character_id === fromId && r.related_character_id === toId) ||
        (r.character_id === toId && r.related_character_id === fromId),
    );
  }

  function renderCell(rel: CharacterRelationship) {
    const s = safeStrength(rel);

    if (mode === "type") {
      const color = typeColor(rel.relationship_type);
      const avg = avgStrength(rel);
      return (
        <div className={styles.cellInner}>
          <div
            className={styles.cellDot}
            style={{
              background: color,
              opacity: 0.35 + (avg / 10) * 0.65,
              width: 8 + avg * 1.4,
              height: 8 + avg * 1.4,
            }}
          />
          <span className={styles.cellLabel} style={{ color }}>
            {rel.relationship_type}
          </span>
        </div>
      );
    }

    if (mode === "purpose") {
      const purposes = rel.narrative_purpose ?? [];
      if (purposes.length === 0)
        return (
          <div className={styles.cellInner}>
            <span className={styles.cellMuted}>—</span>
          </div>
        );
      return (
        <div className={styles.cellInner}>
          <div className={styles.purposePips}>
            {purposes.slice(0, 3).map((p) => (
              <span key={p} className={styles.purposePip} style={{ background: purposeColor(p) }} title={p} />
            ))}
          </div>
          <span className={styles.cellLabel}>{purposes[0]}</span>
          {purposes.length > 1 && <span className={styles.cellMuted}>+{purposes.length - 1}</span>}
        </div>
      );
    }

    const stored =
      mode === "strength"
        ? avgStrength(rel)
        : mode === "trust"
          ? s.trust
          : mode === "power"
            ? s.power
            : s.affection;
    const display = stored - 5; // −5..+5
    const color = strengthColor(stored);
    const opacity = 0.15 + (Math.abs(display) / 5) * 0.85;
    const label = (display >= 0 ? "+" : "") + display.toFixed(mode === "strength" ? 1 : 0);
    return (
      <div className={styles.cellInner}>
        <div className={styles.strengthMeter} style={{ background: color, opacity }}>
          <span className={styles.strengthNum}>{label}</span>
        </div>
      </div>
    );
  }

  // Build legend for current mode
  const legendItems = (() => {
    if (mode === "type") {
      const presentTypes = Array.from(new Set(relationships.map((r) => r.relationship_type.toLowerCase())));
      return presentTypes.map((t) => ({ color: typeColor(t), label: t }));
    }
    if (mode === "purpose") {
      const presentPurposes = Array.from(new Set(relationships.flatMap((r) => r.narrative_purpose ?? [])));
      return presentPurposes.slice(0, 8).map((p) => ({ color: purposeColor(p), label: p }));
    }
    return null;
  })();

  return (
    <div className={styles.wrapper}>
      {/* Mode selector */}
      <div className={styles.modeBar}>
        <span className={styles.modeLabel}>Show:</span>
        <div className={styles.modeBtns}>
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`${styles.modeBtn} ${mode === m.value ? styles.modeBtnActive : ""}`}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cornerCell} />
              {characters.map((c) => (
                <th key={c.id} className={styles.colHeader}>
                  <span className={styles.colName}>{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {characters.map((rowChar) => (
              <tr key={rowChar.id}>
                <td className={styles.rowHeader}>
                  <span className={styles.rowName}>{rowChar.name}</span>
                </td>
                {characters.map((colChar) => {
                  if (rowChar.id === colChar.id) {
                    return <td key={colChar.id} className={styles.selfCell} />;
                  }
                  const rel = findRel(rowChar.id, colChar.id);
                  if (rel && rel.visibility === "hidden" && !showHidden) {
                    return (
                      <td
                        key={colChar.id}
                        className={styles.hiddenCell}
                        title="Hidden relationship"
                        onClick={() => onEditRelationship(rel)}
                      />
                    );
                  }
                  if (rel) {
                    return (
                      <td
                        key={colChar.id}
                        className={styles.filledCell}
                        title={`${rel.relationship_type}${rel.visibility === "hidden" ? " (hidden)" : ""}. Click to edit`}
                        onClick={() => onEditRelationship(rel)}
                      >
                        {renderCell(rel)}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={colChar.id}
                      className={styles.emptyCell}
                      title="Click to add relationship"
                      onClick={() => onCreateRelationship(rowChar.id, colChar.id)}
                    >
                      <span className={styles.addHint}>+</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {legendItems ? (
        <div className={styles.legend}>
          {legendItems.map(({ color, label }) => (
            <span key={label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendGradient} />
            <span className={styles.legendEdge}>−5</span>
            <span className={styles.legendEdge}>0 neutral</span>
            <span className={styles.legendEdge}>+5</span>
          </span>
        </div>
      )}
    </div>
  );
}
