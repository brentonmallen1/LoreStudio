import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import type { ImageTokenBudget } from "../../types";
import type { useModelSettings } from "../../pages/settings/useModelSettings";
import ThinkingField from "../../pages/settings/ThinkingField";
import ModelSharingFields from "./ModelSharingFields";
import styles from "../../pages/Settings.module.css";

/**
 * Settings › Advanced (doc 30 D4): the model's parameters and how it is shared between your
 * replies and longer jobs, folded away under "You can leave these alone". A link to
 * `#model-parameters` opens the fold.
 */
export default function AdvancedSection({ model }: { model: ReturnType<typeof useModelSettings> }) {
  const { params, setParam, paramsSaved, defaultHint, reset: resetLlmSettings } = model;
  const { hash } = useLocation();
  const [open, setOpen] = useState(hash === "#model-parameters");
  // A link to #model-parameters opens the fold (state from the previous render, not an effect).
  const [seenHash, setSeenHash] = useState(hash);
  if (hash !== seenHash) {
    setSeenHash(hash);
    if (hash === "#model-parameters") setOpen(true);
  }

  return (
    <section className={styles.section} id="model-parameters">
      <h2 className={styles.sectionLabel}>Advanced</h2>
      <p className={styles.sectionHint}>
        You can leave these alone. They are tuned for Gemma 4, and Reset to defaults puts back any you change.
      </p>
      <details className={styles.fold} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className={styles.foldSummary}>Model parameters and sharing the model</summary>
        <div className={styles.foldBody}>
          <div className={styles.card}>
            {/* Temperature */}
            <div className={styles.field}>
              <label className={styles.label}>Temperature</label>
              <div className={styles.sliderRow}>
                <input
                  aria-label="Temperature"
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={params?.temperature ?? 1}
                  onChange={(e) => setParam("temperature", parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{(params?.temperature ?? 1).toFixed(2)}</span>
              </div>
              <p className={styles.paramHint}>
                How adventurous its word choices are: lower is steadier, higher is looser.{" "}
                {defaultHint("temperature", 1)}
              </p>
            </div>

            {/* Top-p */}
            <div className={styles.field}>
              <label className={styles.label}>Top-p</label>
              <div className={styles.sliderRow}>
                <input
                  aria-label="Top-p"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={params?.top_p ?? 0.95}
                  onChange={(e) => setParam("top_p", parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{(params?.top_p ?? 0.95).toFixed(2)}</span>
              </div>
              <p className={styles.paramHint}>
                How much of the likely next words it chooses among: lower keeps to the safest.{" "}
                {defaultHint("top_p", 0.95)}
              </p>
            </div>

            {/* Top-k */}
            <div className={styles.field}>
              <label className={styles.label}>Top-k</label>
              <input
                aria-label="Top-k"
                type="number"
                min={1}
                max={200}
                value={params?.top_k ?? 64}
                onChange={(e) => setParam("top_k", parseInt(e.target.value, 10) || 64)}
                className={styles.numberInput}
              />
              <p className={styles.paramHint}>
                How many of the likeliest next words it chooses among. {defaultHint("top_k", 64)}
              </p>
            </div>

            {/* Image token budget */}
            <div className={styles.field}>
              <label className={styles.label}>Image token budget</label>
              <select
                aria-label="Image token budget"
                value={params?.image_token_budget ?? 0}
                onChange={(e) =>
                  setParam("image_token_budget", parseInt(e.target.value, 10) as ImageTokenBudget | 0)
                }
                className={styles.selectInput}
              >
                <option value={0}>None (text only)</option>
                <option value={70}>70: Fast (classification, quick captioning)</option>
                <option value={140}>140: Light (general thumbnails)</option>
                <option value={280}>280: Balanced (recommended default)</option>
                <option value={560}>560: Detailed (document analysis)</option>
                <option value={1120}>1120: High detail (OCR, fine text)</option>
              </select>
              <p className={styles.paramHint}>
                How closely it looks at a picture you show it: more detail is slower.
              </p>
            </div>

            <ThinkingField
              value={params?.thinking_mode ?? "helps"}
              onChange={(mode) => setParam("thinking_mode", mode)}
            />

            <div className={styles.cardFooter}>
              <button onClick={resetLlmSettings} className={styles.resetBtn}>
                Reset to defaults
              </button>
              {paramsSaved && (
                <span className={styles.autoSaved}>
                  <Check size={11} /> Saved
                </span>
              )}
            </div>
          </div>
          <ModelSharingFields />
        </div>
      </details>
    </section>
  );
}
