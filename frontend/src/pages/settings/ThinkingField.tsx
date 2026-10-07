import { THINKING_MODES, type ThinkingMode } from "../../lib/ai/thinking";
import styles from "../Settings.module.css";

/** Settings › Model parameters: when Gemma reasons before answering (off, where it helps, always). */
export default function ThinkingField({
  value,
  onChange,
}: {
  value: ThinkingMode;
  onChange: (mode: ThinkingMode) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="thinking-mode">
        Thinking
      </label>
      <select
        id="thinking-mode"
        value={value}
        onChange={(e) => onChange(e.target.value as ThinkingMode)}
        className={styles.selectInput}
      >
        {THINKING_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <p className={styles.paramHint}>
        Gemma 4 reasons before answering: more considered, slower. Where it helps: conversations about the
        story, What-If and the planner, and the whole-book analyses; not interviews, summaries or suggestions.
        A conversation can choose for itself in its own settings. Earlier thoughts are never sent back to the
        model.
      </p>
    </div>
  );
}
