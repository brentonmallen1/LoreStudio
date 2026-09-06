import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { setAIEnabled, useAIAvailable } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

const CEILINGS = [
  { value: 0, label: "No ceiling — use what the model allows" },
  { value: 8192, label: "8K — small VRAM" },
  { value: 16384, label: "16K" },
  { value: 32768, label: "32K" },
  { value: 65536, label: "64K — large VRAM" },
];

/**
 * The AI master switch and the context ceiling (doc 06 §7).
 *
 * Off is not cosmetic: every AI surface disappears and the gateway refuses calls, so a
 * stale tab or a keyboard shortcut cannot reach a model after you have said no.
 */
export default function AISwitchCard() {
  const available = useAIAvailable();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [ceiling, setCeiling] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getAISettings()
      .then((s) => live && setEnabled(s.enabled))
      .catch(() => live && setEnabled(true));
    api
      .getLLMSettings()
      .then((s) => live && setCeiling(s.num_ctx_max ?? 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      await setAIEnabled(next);
      setEnabled(next);
    } finally {
      setSaving(false);
    }
  }

  async function saveCeiling(next: number) {
    setCeiling(next);
    await api.updateLLMSettings({ num_ctx_max: next || null });
  }

  return (
    <div className={styles.card}>
      <div className={styles.field}>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={enabled ?? true}
            disabled={enabled === null || saving}
            onChange={(e) => toggle(e.target.checked)}
          />{" "}
          Use AI features
        </label>
        <p className={styles.sectionHint}>
          {enabled === false
            ? "AI is off. No AI surface is shown anywhere, and the server refuses AI calls even if one is requested. Your manuscript tools, checks and exports are unaffected."
            : "When this is off, every AI surface disappears and the server refuses AI calls. Non-AI tools — checks, quote normalisation, NLP analyses, export — keep working."}
          {available ? "" : " Writer mode also hides AI; this switch is separate."}
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Context window ceiling</label>
        <select
          className={styles.input}
          value={ceiling}
          disabled={enabled === false}
          onChange={(e) => saveCeiling(Number(e.target.value))}
        >
          {CEILINGS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className={styles.sectionHint}>
          Each feature asks for the window it needs — a whole-manuscript analysis asks for more than a scene
          chat. This caps every request, whatever the model would allow, for machines where a large window
          does not fit in VRAM.
        </p>
      </div>
    </div>
  );
}
