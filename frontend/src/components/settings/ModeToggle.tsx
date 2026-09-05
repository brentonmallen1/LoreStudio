import { useState } from "react";
import { setMode, useMode, type UIMode } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

const OPTIONS: { value: UIMode; label: string; hint: string }[] = [
  {
    value: "writer",
    label: "Writer",
    hint: "Manuscript, structure, notes, dialogue tools, checks, export and backups. No AI features are shown.",
  },
  {
    value: "studio",
    label: "Studio",
    hint: "Everything, including the AI assistant, analyses and worldbuilding depth.",
  },
];

/** Writer / Studio mode (per account). */
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
    <div className={styles.settingGroup}>
      <p className={styles.settingGroupLabel}>Mode</p>
      <div className={styles.fieldRow} role="radiogroup" aria-label="Interface mode">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={styles.label}
            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}
          >
            <input
              type="radio"
              name="ui-mode"
              value={o.value}
              checked={mode === o.value}
              disabled={saving}
              onChange={() => choose(o.value)}
            />
            <span>
              <strong>{o.label}</strong>
              <br />
              <span className={styles.paramHint}>{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
