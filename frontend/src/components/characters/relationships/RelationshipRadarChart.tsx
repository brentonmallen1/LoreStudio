import { useState, useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Character, CharacterRelationship } from "../../../types";
import { STRENGTH_DIMS } from "./StrengthSliders";
import styles from "./RelationshipRadarChart.module.css";

interface Props {
  focusCharacterId: string;
  characters: Character[];
  relationships: CharacterRelationship[];
}

const PALETTE = [
  "#7898c9",
  "#c97878",
  "#c9a060",
  "#a06090",
  "#609878",
  "#c9c060",
  "#6090a0",
  "#c090a0",
  "#90a060",
  "#a08060",
];

// Recharts radar data: one object per axis dimension
type ChartRow = { subject: string; negLabel: string; posLabel: string; [charId: string]: number | string };

function buildChartData(selectedIds: string[], relationships: CharacterRelationship[]): ChartRow[] {
  return STRENGTH_DIMS.map((dim) => {
    const row: ChartRow = { subject: dim.label, negLabel: dim.negLabel, posLabel: dim.posLabel };
    for (const charId of selectedIds) {
      const rel = relationships.find((r) => r.related_character_id === charId);
      const s = (rel?.strength as unknown as Record<string, number> | null) ?? {};
      row[charId] = Number(s[dim.key]) || 5;
    }
    return row;
  });
}

function tickFormatter(value: number) {
  const display = value - 5;
  return display > 0 ? `+${display}` : String(display);
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  characters,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  characters: Character[];
}) {
  if (!active || !payload?.length) return null;
  const dim = STRENGTH_DIMS.find((d) => d.label === label);
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{label}</p>
      {dim && (
        <p className={styles.tooltipSub}>
          {dim.negLabel} ← 0 → {dim.posLabel}
        </p>
      )}
      {payload.map((entry) => {
        const name = characters.find((c) => c.id === entry.dataKey)?.name ?? entry.dataKey;
        const display = entry.value - 5;
        return (
          <div key={entry.dataKey} className={styles.tooltipRow}>
            <span className={styles.tooltipDot} style={{ background: entry.color }} />
            <span className={styles.tooltipName}>{name}</span>
            <span
              className={styles.tooltipVal}
              style={{
                color: display < 0 ? "#a06090" : display > 0 ? "#609878" : "var(--color-text-subtle)",
              }}
            >
              {display > 0 ? "+" : ""}
              {display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CustomLegend({
  selectedIds,
  characters,
  palette,
}: {
  selectedIds: string[];
  characters: Character[];
  palette: string[];
}) {
  return (
    <div className={styles.legend}>
      {selectedIds.map((id, i) => {
        const name = characters.find((c) => c.id === id)?.name ?? id;
        return (
          <div key={id} className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: palette[i % palette.length] }} />
            <span className={styles.legendName}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function RelationshipRadarChart({ focusCharacterId, characters, relationships }: Props) {
  const related = useMemo(
    () =>
      characters.filter(
        (c) => c.id !== focusCharacterId && relationships.some((r) => r.related_character_id === c.id),
      ),
    [characters, relationships, focusCharacterId],
  );

  const [selected, setSelected] = useState<string[]>(() => related.slice(0, 5).map((c) => c.id));

  function toggleCharacter(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const chartData = useMemo(() => buildChartData(selected, relationships), [selected, relationships]);

  return (
    <div className={styles.root}>
      {/* Character selector */}
      <div className={styles.selector}>
        <span className={styles.selectorLabel}>Compare:</span>
        <div className={styles.chips}>
          {related.length === 0 && <span className={styles.empty}>No relationships to compare yet</span>}
          {related.map((c, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const active = selected.includes(c.id);
            return (
              <button
                key={c.id}
                className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                style={active ? { borderColor: color, background: color + "22", color } : undefined}
                onClick={() => toggleCharacter(c.id)}
              >
                <span
                  className={styles.chipDot}
                  style={{ background: active ? color : "var(--color-border)" }}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {selected.length > 0 ? (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={420}>
            <RadarChart data={chartData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "var(--color-text-muted)", fontSize: 12, fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tickCount={6}
                tickFormatter={tickFormatter}
                tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }}
                stroke="var(--color-border)"
              />
              {selected.map((charId, idx) => (
                <Radar
                  key={charId}
                  name={charId}
                  dataKey={charId}
                  stroke={PALETTE[idx % PALETTE.length]}
                  fill={PALETTE[idx % PALETTE.length]}
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={{ r: 4, fill: PALETTE[idx % PALETTE.length], strokeWidth: 0 }}
                />
              ))}
              <Tooltip content={<CustomTooltip characters={characters} />} />
            </RadarChart>
          </ResponsiveContainer>

          <CustomLegend selectedIds={selected} characters={characters} palette={PALETTE} />
        </div>
      ) : (
        <div className={styles.noSelection}>Select characters above to compare</div>
      )}

      {/* Dimension key */}
      <div className={styles.dimKey}>
        {STRENGTH_DIMS.map((d) => (
          <div key={d.key} className={styles.dimRow}>
            <span className={styles.dimLabel}>{d.label}:</span>
            <span className={styles.dimRange}>
              {d.negLabel} → {d.posLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
