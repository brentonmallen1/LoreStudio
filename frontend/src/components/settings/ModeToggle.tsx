import { useState } from "react";
import { setMode, useMode, type UIMode } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

/** The same two answers the welcome asks (doc 30 D4), in the same words. */
const OPTIONS: { value: UIMode; label: string; hint: string }[] = [
  {
    value: "writer",
    label: "Just me and my writing",
    hint: "Writer mode. No AI anywhere. The checks, counts and organizing still work, all on this computer.",
  },
  {
    value: "studio",
    label: "With an Assistant to ask",
    hint: "Studio mode. An AI you run yourself can answer questions about your story and read drafts. It never writes your prose. Needs a one-time setup.",
  },
];

/** Settings › Mode: Writer or Studio, per account (doc 30 D4 moved it out of Appearance). */
export default function ModeToggle() {
  const mode = useMode();
  const [saving, setSaving] = useState(false);

  async function choose(next: UIMode) {
    if (next === mode) return;
    setSaving(true);
    try {
      await setMode(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modeChoices} role="radiogroup" aria-label="Do you want the Assistant?">
      {OPTIONS.map((o) => (
        <label key={o.value} className={styles.modeChoice} data-on={mode === o.value || undefined}>
          <input
            type="radio"
            name="ui-mode"
            value={o.value}
            checked={mode === o.value}
            disabled={saving}
            onChange={() => choose(o.value)}
          />
          <span className={styles.modeChoiceText}>
            <span className={styles.modeChoiceLabel}>{o.label}</span>
            <span className={styles.paramHint}>{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
