import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { Modal } from "../common";
import { api } from "../../api/client";
import type { LLMParams, LLMSettings, ImageTokenBudget } from "../../types";
import styles from "./ChatSettingsModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user applies settings for this session. */
  onApply: (params: LLMParams) => void;
  /** Current session-level overrides, if any. */
  sessionParams?: LLMParams;
}

const TOKEN_BUDGET_OPTIONS: { value: ImageTokenBudget | 0; label: string }[] = [
  { value: 0, label: "None (text only)" },
  { value: 70, label: "70 — Fast (classification, quick captioning)" },
  { value: 140, label: "140 — Light (general thumbnails)" },
  { value: 280, label: "280 — Balanced (recommended default)" },
  { value: 560, label: "560 — Detailed (document analysis)" },
  { value: 1120, label: "1120 — High detail (OCR, fine text)" },
];

export default function ChatSettingsModal({ isOpen, onClose, onApply, sessionParams }: Props) {
  const [globalSettings, setGlobalSettings] = useState<LLMSettings | null>(null);
  const [temperature, setTemperature] = useState(1.0);
  const [topP, setTopP] = useState(0.95);
  const [topK, setTopK] = useState(64);
  const [thinking, setThinking] = useState(false);
  const [tokenBudget, setTokenBudget] = useState<ImageTokenBudget | 0>(0);

  useEffect(() => {
    if (!isOpen) return;
    api.getLLMSettings().then((s) => {
      setGlobalSettings(s);
      // Prefer session-level overrides; fall back to global settings
      setTemperature(sessionParams?.temperature ?? s.temperature);
      setTopP(sessionParams?.top_p ?? s.top_p);
      setTopK(sessionParams?.top_k ?? s.top_k);
      setThinking(sessionParams?.thinking_enabled ?? s.thinking_enabled);
      setTokenBudget(sessionParams?.image_token_budget ?? s.image_token_budget ?? 0);
    }).catch(() => {});
  }, [isOpen]);

  function handleApply() {
    onApply({
      temperature,
      top_p: topP,
      top_k: topK,
      thinking_enabled: thinking,
      image_token_budget: tokenBudget || undefined,
    });
    onClose();
  }

  function handleReset() {
    if (!globalSettings) return;
    setTemperature(globalSettings.temperature);
    setTopP(globalSettings.top_p);
    setTopK(globalSettings.top_k);
    setThinking(globalSettings.thinking_enabled);
    setTokenBudget(globalSettings.image_token_budget ?? 0);
  }

  const footer = (
    <div className={styles.footer}>
      <button className={styles.resetBtn} onClick={handleReset}>
        Reset to global defaults
      </button>
      <button className={styles.saveBtn} onClick={handleApply}>
        Apply for this session
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Parameters"
      icon={<Settings2 size={15} />}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        {/* Temperature */}
        <div className={styles.field}>
          <label className={styles.label}>Temperature</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min={0} max={2} step={0.01}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className={styles.slider}
            />
            <span className={styles.sliderValue}>{temperature.toFixed(2)}</span>
          </div>
          <p className={styles.hint}>Controls randomness. Gemma 4 default: 1.0</p>
        </div>

        {/* Top-p */}
        <div className={styles.field}>
          <label className={styles.label}>Top-p</label>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={topP}
              onChange={(e) => setTopP(parseFloat(e.target.value))}
              className={styles.slider}
            />
            <span className={styles.sliderValue}>{topP.toFixed(2)}</span>
          </div>
          <p className={styles.hint}>Nucleus sampling cutoff. Gemma 4 default: 0.95</p>
        </div>

        {/* Top-k */}
        <div className={styles.field}>
          <label className={styles.label}>Top-k</label>
          <input
            type="number"
            min={1} max={200}
            value={topK}
            onChange={(e) => setTopK(parseInt(e.target.value, 10) || 64)}
            className={styles.numberInput}
          />
          <p className={styles.hint}>Limits vocabulary to top-k tokens per step. Gemma 4 default: 64</p>
        </div>

        {/* Image token budget */}
        <div className={styles.field}>
          <label className={styles.label}>Image Token Budget</label>
          <select
            value={tokenBudget}
            onChange={(e) => setTokenBudget(parseInt(e.target.value, 10) as ImageTokenBudget | 0)}
            className={styles.selectInput}
          >
            {TOKEN_BUDGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className={styles.hint}>
            Higher budgets preserve more image detail for OCR or fine-text analysis. Lower budgets are faster for classification or simple captioning.
          </p>
        </div>

        <hr className={styles.divider} />

        {/* Thinking mode */}
        <div className={styles.toggleRow}>
          <div className={styles.toggleLabel}>
            <label className={styles.label}>Thinking Mode</label>
            <span className={styles.hint}>Gemma 4 reasons before responding — improves accuracy, increases latency.</span>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={thinking}
              onChange={(e) => setThinking(e.target.checked)}
            />
            <span className={styles.toggleTrack} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
