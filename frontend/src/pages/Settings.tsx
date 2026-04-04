import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, Monitor, Feather, BookOpen, ChevronRight } from "lucide-react";
import { useUIStore, THEME_META, FONT_OPTIONS, FONT_CATEGORIES } from "../stores/uiStore";
import type { ThemeName, ColorMode, EditorFontFamily, EditorFontSize, EditorLineWidth } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
import { api } from "../api/client";
import type { LLMSettings, ImageTokenBudget } from "../types";
import styles from "./Settings.module.css";

const OLLAMA_URL_KEY = "ls_ollama_url";
const OLLAMA_MODEL_KEY = "ls_ollama_model";

const THEME_SWATCHES: Record<string, string[]> = {
  zen: ["#f7f6f3", "#4a7c59", "#8b6aa8"],
  "e-ink": ["#ede9de", "#4a7a58", "#7a5a98"],
  nord: ["#ECEFF4", "#5E81AC", "#BF616A"],
  solarized: ["#fdf6e3", "#2aa198", "#dc322f"],
  dracula: ["#282A36", "#50FA7B", "#BD93F9"],
  gruvbox: ["#fbf1c7", "#458588", "#b16286"],
  catppuccin: ["#EFF1F5", "#8839EF", "#C6A0F6"],
};

export default function SettingsPage() {
  const { themeName, colorMode, setThemeName, setColorMode, editorFontFamily, editorFontSize, editorLineWidth, setEditorFontFamily, setEditorFontSize, setEditorLineWidth } = useUIStore();
  const { user } = useAuthStore();
  const [ollamaUrl, setOllamaUrl] = useState(localStorage.getItem(OLLAMA_URL_KEY) ?? "http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem(OLLAMA_MODEL_KEY) ?? "gemma4");
  const [saved, setSaved] = useState(false);

  // LLM parameter settings
  const [, setLlmSettings] = useState<LLMSettings | null>(null);
  const [llmTemperature, setLlmTemperature] = useState(1.0);
  const [llmTopP, setLlmTopP] = useState(0.95);
  const [llmTopK, setLlmTopK] = useState(64);
  const [llmThinking, setLlmThinking] = useState(false);
  const [llmTokenBudget, setLlmTokenBudget] = useState<ImageTokenBudget | 0>(0);
  const [llmSaved, setLlmSaved] = useState(false);

  useEffect(() => {
    api.getLLMSettings().then((s) => {
      setLlmSettings(s);
      setLlmTemperature(s.temperature);
      setLlmTopP(s.top_p);
      setLlmTopK(s.top_k);
      setLlmThinking(s.thinking_enabled);
      setLlmTokenBudget(s.image_token_budget ?? 0);
    }).catch(() => {});
  }, []);

  async function saveLlmSettings() {
    const updated = await api.updateLLMSettings({
      temperature: llmTemperature,
      top_p: llmTopP,
      top_k: llmTopK,
      thinking_enabled: llmThinking,
      image_token_budget: llmTokenBudget || undefined,
    });
    setLlmSettings(updated);
    setLlmSaved(true);
    setTimeout(() => setLlmSaved(false), 2000);
  }

  async function resetLlmSettings() {
    const updated = await api.resetLLMSettings();
    setLlmSettings(updated);
    setLlmTemperature(updated.temperature);
    setLlmTopP(updated.top_p);
    setLlmTopK(updated.top_k);
    setLlmThinking(updated.thinking_enabled);
    setLlmTokenBudget(updated.image_token_budget ?? 0);
  }

  function saveOllamaConfig() {
    localStorage.setItem(OLLAMA_URL_KEY, ollamaUrl);
    localStorage.setItem(OLLAMA_MODEL_KEY, ollamaModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const customThemeOptions: { value: ThemeName; label: string; Icon: typeof Feather }[] = [
    { value: "zen", label: "Zen", Icon: Feather },
    { value: "e-ink", label: "E-ink", Icon: BookOpen },
  ];

  const presetThemeOptions: { value: ThemeName; label: string }[] = [
    { value: "nord", label: "Nord" },
    { value: "solarized", label: "Solarized" },
    { value: "dracula", label: "Dracula" },
    { value: "gruvbox", label: "Gruvbox" },
    { value: "catppuccin", label: "Catppuccin" },
  ];

  const colorModeOptions: { value: ColorMode; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];

  const fontSizeOptions: { value: EditorFontSize; label: string }[] = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
    { value: "xl", label: "X-Large" },
  ];

  const lineWidthOptions: { value: EditorLineWidth; label: string }[] = [
    { value: "narrow", label: "Narrow" },
    { value: "medium", label: "Medium" },
    { value: "wide", label: "Wide" },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <main className={styles.main}>
        {/* Appearance */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Appearance</h2>

          <div className={styles.settingGroup}>
            <p className={styles.settingGroupLabel}>Theme</p>
            <div className={styles.themeSubGroup}>
              <p className={styles.themeSubLabel}>Custom</p>
              <div className={styles.themeRow}>
                {customThemeOptions.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setThemeName(value)}
                    className={`${styles.themeOption} ${themeName === value ? styles.active : ""}`}
                  >
                    <div className={styles.themeSwatch}>
                      {THEME_SWATCHES[value].map((color, i) => (
                        <span key={i} className={styles.swatchDot} style={{ background: color }} />
                      ))}
                    </div>
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.themeSubGroup}>
              <p className={styles.themeSubLabel}>Presets</p>
              <div className={styles.themePresetGrid}>
                {presetThemeOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setThemeName(value)}
                    className={`${styles.themeOption} ${themeName === value ? styles.active : ""}`}
                  >
                    <div className={styles.themeSwatch}>
                      {THEME_SWATCHES[value].map((color, i) => (
                        <span key={i} className={styles.swatchDot} style={{ background: color }} />
                      ))}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.settingGroup}>
            <p className={styles.settingGroupLabel}>Color Mode</p>
            <div className={styles.themeRow}>
              {colorModeOptions.map(({ value, label, Icon }) => {
                const isDisabled = value === "light" && THEME_META[themeName].darkOnly;
                return (
                  <button
                    key={value}
                    onClick={() => setColorMode(value)}
                    disabled={isDisabled}
                    className={`${styles.themeOption} ${colorMode === value ? styles.active : ""}`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Typography</h2>

          <div className={styles.settingGroup}>
            <p className={styles.settingGroupLabel}>Editor Font</p>
            <select
              className={styles.fontSelect}
              value={editorFontFamily}
              onChange={(e) => setEditorFontFamily(e.target.value as EditorFontFamily)}
              style={{ fontFamily: FONT_OPTIONS.find((f) => f.value === editorFontFamily)?.stack }}
            >
              {FONT_CATEGORIES.map(({ value: cat, label: catLabel }) => (
                <optgroup key={cat} label={catLabel}>
                  {FONT_OPTIONS.filter((f) => f.category === cat).map(({ value, label, stack }) => (
                    <option key={value} value={value} style={{ fontFamily: stack }}>{label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={styles.settingGroup}>
            <p className={styles.settingGroupLabel}>Editor Font Size</p>
            <div className={styles.themeRow}>
              {fontSizeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setEditorFontSize(value)}
                  className={`${styles.themeOption} ${editorFontSize === value ? styles.active : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.settingGroup}>
            <p className={styles.settingGroupLabel}>Line Width</p>
            <div className={styles.themeRow}>
              {lineWidthOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setEditorLineWidth(value)}
                  className={`${styles.themeOption} ${editorLineWidth === value ? styles.active : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* LLM Config */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>AI / LLM</h2>
          <div className={styles.card}>
            <div className={styles.field}>
              <label className={styles.label}>Ollama URL</label>
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Model</label>
              <input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className={styles.input}
              />
            </div>
            <button onClick={saveOllamaConfig} className={styles.saveBtn}>
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          <Link to="/settings/ai-prompts" className={styles.subpageLink}>
            AI Prompts
            <ChevronRight size={14} />
          </Link>
        </section>

        {/* LLM Parameters */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Model Parameters</h2>
          <div className={styles.card}>
            {/* Temperature */}
            <div className={styles.field}>
              <label className={styles.label}>Temperature</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min={0} max={2} step={0.01}
                  value={llmTemperature}
                  onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{llmTemperature.toFixed(2)}</span>
              </div>
              <p className={styles.paramHint}>Controls randomness. Gemma 4 default: 1.0</p>
            </div>

            {/* Top-p */}
            <div className={styles.field}>
              <label className={styles.label}>Top-p</label>
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  min={0} max={1} step={0.01}
                  value={llmTopP}
                  onChange={(e) => setLlmTopP(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{llmTopP.toFixed(2)}</span>
              </div>
              <p className={styles.paramHint}>Nucleus sampling cutoff. Gemma 4 default: 0.95</p>
            </div>

            {/* Top-k */}
            <div className={styles.field}>
              <label className={styles.label}>Top-k</label>
              <input
                type="number"
                min={1} max={200}
                value={llmTopK}
                onChange={(e) => setLlmTopK(parseInt(e.target.value, 10) || 64)}
                className={styles.numberInput}
              />
              <p className={styles.paramHint}>Limits vocabulary to top-k tokens per step. Gemma 4 default: 64</p>
            </div>

            {/* Image token budget */}
            <div className={styles.field}>
              <label className={styles.label}>Image Token Budget</label>
              <select
                value={llmTokenBudget}
                onChange={(e) => setLlmTokenBudget(parseInt(e.target.value, 10) as ImageTokenBudget | 0)}
                className={styles.selectInput}
              >
                <option value={0}>None (text only)</option>
                <option value={70}>70 — Fast (classification, quick captioning)</option>
                <option value={140}>140 — Light (general thumbnails)</option>
                <option value={280}>280 — Balanced (recommended default)</option>
                <option value={560}>560 — Detailed (document analysis)</option>
                <option value={1120}>1120 — High detail (OCR, fine text)</option>
              </select>
              <p className={styles.paramHint}>Controls image resolution when using Gemma 4 multimodal features. Higher budgets use more tokens.</p>
            </div>

            {/* Thinking mode */}
            <div className={styles.toggleRow}>
              <div className={styles.toggleLabel}>
                <label className={styles.label}>Thinking Mode</label>
                <span className={styles.toggleHint}>Gemma 4 reasons before responding. Improves accuracy, increases latency.</span>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={llmThinking}
                  onChange={(e) => setLlmThinking(e.target.checked)}
                />
                <span className={styles.toggleTrack} />
              </label>
            </div>

            <div className={styles.cardFooter}>
              <button onClick={resetLlmSettings} className={styles.resetBtn}>
                Reset to defaults
              </button>
              <button onClick={saveLlmSettings} className={styles.saveBtn}>
                {llmSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </section>

        {/* Account */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Account</h2>
          <div className={styles.card}>
            <p className={styles.accountName}>{user?.display_name}</p>
            <p className={styles.accountUsername}>@{user?.username}</p>
            {user?.is_admin && (
              <span className={styles.adminBadge}>Admin</span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
