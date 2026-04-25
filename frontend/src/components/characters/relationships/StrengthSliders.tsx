import type { StrengthDimensions } from "../../../types";
import styles from "./StrengthSliders.module.css";

// All stored as 0–10; display remapped to −5…+5 (center 5 = neutral 0)
export const STRENGTH_DIMS: {
  key: keyof StrengthDimensions;
  label: string;
  negLabel: string;
  posLabel: string;
  color: string;
}[] = [
  { key: "trust",     label: "Trust",         negLabel: "Distrust",  posLabel: "Trust",      color: "#7898c9" },
  { key: "power",     label: "Power Balance", negLabel: "Submits",   posLabel: "Dominates",  color: "#c9a060" },
  { key: "affection", label: "Affection",     negLabel: "Hostile",   posLabel: "Bonded",     color: "#c97878" },
  { key: "tension",   label: "Tension",       negLabel: "Harmony",   posLabel: "Conflict",   color: "#a06090" },
  { key: "openness",  label: "Openness",      negLabel: "Guarded",   posLabel: "Vulnerable", color: "#609878" },
];

interface Props {
  value: StrengthDimensions;
  onChange: (next: StrengthDimensions) => void;
  readOnly?: boolean;
}

export default function StrengthSliders({ value, onChange, readOnly }: Props) {
  return (
    <div className={styles.root}>
      {STRENGTH_DIMS.map(({ key, label, negLabel, posLabel, color }) => {
        const stored = Number((value as unknown as Record<string, number>)[key]) || 5;
        const display = stored - 5; // −5 to +5
        const pctLeft  = stored < 5 ? ((5 - stored) / 5) * 50 : 0;
        const pctRight = stored > 5 ? ((stored - 5) / 5) * 50 : 0;

        return (
          <div key={key} className={styles.row}>
            <div className={styles.header}>
              <span className={styles.label}>{label}</span>
              <span
                className={`${styles.displayVal} ${display < 0 ? styles.neg : display > 0 ? styles.pos : styles.zero}`}
                title={`${label}: ${display > 0 ? "+" : ""}${display}`}
              >
                {display > 0 ? "+" : ""}{display}
              </span>
            </div>
            <div className={styles.track}>
              <span className={styles.trackLabel}>{negLabel}</span>
              <div className={styles.barWrap}>
                {/* Left fill (negative) */}
                <div className={styles.leftHalf}>
                  <div className={styles.leftFill} style={{ width: `${pctLeft * 2}%`, background: color, opacity: 0.55 }} />
                </div>
                {/* Center tick */}
                <div className={styles.centerTick} />
                {/* Right fill (positive) */}
                <div className={styles.rightHalf}>
                  <div className={styles.rightFill} style={{ width: `${pctRight * 2}%`, background: color }} />
                </div>
              </div>
              <span className={styles.trackLabel}>{posLabel}</span>
            </div>
            <div className={styles.sliderWrap}>
              <span className={styles.sliderEdge}>−5</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={stored}
                disabled={readOnly}
                className={styles.slider}
                style={{ accentColor: color }}
                onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
              />
              <span className={styles.sliderEdge}>+5</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
