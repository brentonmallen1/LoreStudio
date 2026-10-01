import { AlertTriangle, Info } from "lucide-react";
import styles from "./ContextLevelSelector.module.css";

export type ContextLevel = "full" | "summaries" | "section";

interface Props {
  value: ContextLevel;
  onChange: (level: ContextLevel) => void;
}

const LEVELS: { value: ContextLevel; label: string; description: string }[] = [
  {
    value: "full",
    label: "Full Manuscript",
    description: "Sends all prose: best quality for voice consistency and comparative analysis",
  },
  {
    value: "summaries",
    label: "With summaries",
    description: "Uses scene summaries as compressed context: good balance for most analyses",
  },
  {
    value: "section",
    label: "Section only",
    description: "Scoped content only, no cross-reference: fastest, may miss continuity patterns",
  },
];

export function ContextLevelSelector({ value, onChange }: Props) {
  return (
    <div className={styles.root}>
      <label className={styles.label}>Context</label>
      <div className={styles.options}>
        {LEVELS.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.option} ${value === opt.value ? styles.optionActive : ""}`}
            onClick={() => onChange(opt.value)}
            title={opt.description}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className={styles.description}>
        <Info size={11} className={styles.infoIcon} />
        {LEVELS.find((l) => l.value === value)?.description}
      </p>
      {value === "full" && (
        <div className={styles.warning}>
          <AlertTriangle size={12} />
          <span>
            Full Manuscript requires a model with a large context window (128K+ tokens) and sufficient
            hardware. The analysis may fail if your model cannot handle the full text. If it fails, try{" "}
            <strong>With summaries</strong> instead.
          </span>
        </div>
      )}
    </div>
  );
}
