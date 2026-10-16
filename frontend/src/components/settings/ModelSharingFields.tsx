import { useEffect, useState } from "react";
import { api } from "../../api/client";
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
 * Settings › Advanced: how much the model reads at once (doc 06 §7), how long jobs wait after a
 * reply (doc 21) and whether the model answers several requests at once. One plain sentence a
 * field (doc 30 D4); the guide says more.
 */
export default function ModelSharingFields() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [ceiling, setCeiling] = useState<number>(0);
  const [cooldown, setCooldown] = useState<number>(60);
  const [parallel, setParallel] = useState(false);

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
        <p className={styles.paramHint}>
          How much of your story the model reads at once: lower it if your computer runs short of memory.
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
        <p className={styles.paramHint}>
          Your replies always go first; after one, longer jobs wait this long before they carry on.
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
        <p className={styles.paramHint}>
          Only if Ollama was started to answer several at once (OLLAMA_NUM_PARALLEL above 1) or the model is
          hosted; leave it off if you are not sure.
        </p>
      </div>
    </div>
  );
}
