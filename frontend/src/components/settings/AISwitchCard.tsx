import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { setAIEnabled, useAIAvailable } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

const CEILINGS = [
  { value: 0, label: "No ceiling: use what the model allows" },
  { value: 8192, label: "8K (small VRAM)" },
  { value: 16384, label: "16K" },
  { value: 32768, label: "32K" },
  { value: 65536, label: "64K (large VRAM)" },
];

/** How long the model's jobs wait after the author's last reply (doc 21 P3). */
const COOLDOWNS = [
  { value: 0, label: "No wait" },
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
];

/**
 * The AI master switch, the context ceiling (doc 06 §7), the jobs' cool-down (doc 21) and
 * whether the model answers several requests at once.
 *
 * Off is not cosmetic: every AI surface disappears and the gateway refuses calls, so a
 * stale tab or a keyboard shortcut cannot reach a model after you have said no.
 */
export default function AISwitchCard() {
  const available = useAIAvailable();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [ceiling, setCeiling] = useState<number>(0);
  const [cooldown, setCooldown] = useState<number>(60);
  const [parallel, setParallel] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getAISettings()
      .then((s) => {
        if (!live) return;
        setEnabled(s.enabled);
        setCooldown(s.jobs_cooldown_seconds ?? 60);
        setParallel(s.model_parallel ?? false);
      })
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

  async function saveCooldown(next: number) {
    setCooldown(next);
    await api.updateAISettings({ jobs_cooldown_seconds: next });
  }

  async function saveParallel(next: boolean) {
    setParallel(next);
    await api.updateAISettings({ model_parallel: next });
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
            : "When this is off, every AI surface disappears and the server refuses AI calls. Non-AI tools (checks, quote normalisation, NLP analyses, export) keep working."}
          {available ? "" : " Writer mode also hides AI; this switch is separate."}
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Context window ceiling</label>
        <select
          aria-label="Context window ceiling"
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
          Each feature asks for the window it needs: a whole-manuscript analysis asks for more than a scene
          chat. This caps every request, whatever the model would allow, for machines where a large window
          does not fit in VRAM.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>After a reply, jobs wait</label>
        <select
          aria-label="After a reply, jobs wait"
          className={styles.input}
          value={COOLDOWNS.some((c) => c.value === cooldown) ? cooldown : 60}
          disabled={enabled === false || parallel}
          onChange={(e) => void saveCooldown(Number(e.target.value))}
        >
          {COOLDOWNS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className={styles.sectionHint}>
          The model answers one thing at a time, and your replies always go first: a reply stops the job that
          is running, which carries on from where it was. After your last reply, jobs wait this long before
          starting again, so a conversation is never held up between turns. Start now, in Jobs, skips the
          wait.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={parallel}
            disabled={enabled === false}
            onChange={(e) => void saveParallel(e.target.checked)}
          />{" "}
          My model answers several requests at once
        </label>
        <p className={styles.sectionHint}>
          Turn this on for Ollama started with OLLAMA_NUM_PARALLEL above 1, or a hosted model. Then a reply no
          longer stops a job and there is no wait after it: replies and jobs share the model side by side.
          Jobs still run one at a time. Leave it off if you are not sure: on a model that answers one thing at
          a time, your replies would wait behind a job.
        </p>
      </div>
    </div>
  );
}
