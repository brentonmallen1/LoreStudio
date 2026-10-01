import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Sun,
  Moon,
  Monitor,
  Feather,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Check,
} from "lucide-react";
import { useUIStore, THEME_META } from "../stores/uiStore";
import type { ThemeName, ColorMode } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
import { api } from "../api/client";
import type { LLMSettings, ImageTokenBudget } from "../types";
import DatabaseBackupCard from "../components/settings/DatabaseBackupCard";
import ModeToggle from "../components/settings/ModeToggle";
import TypographySection from "../components/settings/TypographySection";
import ShortcutsSection from "../components/settings/ShortcutsSection";
import AISwitchCard from "../components/settings/AISwitchCard";
import BackupDefaultsCard from "../components/settings/BackupDefaultsCard";
import CodexSection from "../components/settings/CodexSection";
import PrivacySection from "../components/settings/PrivacySection";
import SettingsNav from "../components/settings/SettingsNav";
import { useMode } from "../lib/mode";
import styles from "./Settings.module.css";

const OLLAMA_URL_DEFAULT = "http://localhost:11434";

// ── Model picker combobox ─────────────────────────────────────────────────────

interface OllamaModel {
  name: string;
  size: number;
  details?: { parameter_size?: string };
}

interface ModelPickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function ModelPicker({ value, onChange, placeholder = "e.g. gemma4" }: ModelPickerProps) {
  const [models, setModels] = useState<OllamaModel[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep local query in sync if parent value changes externally
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function loadModels() {
    setFetching(true);
    try {
      const data = await api.ollamaModels();
      setModels(data.models);
      setOpen(true);
    } catch {
      setModels([]);
    } finally {
      setFetching(false);
    }
  }

  const filtered = models ? models.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div className={styles.modelPicker} ref={containerRef}>
      <div className={styles.modelInputRow}>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            if (models) setOpen(true);
          }}
          onFocus={() => {
            if (models && models.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          spellCheck={false}
        />
        <button
          className={styles.modelRefreshBtn}
          onClick={loadModels}
          disabled={fetching}
          title="Load available models from Ollama"
          type="button"
        >
          {fetching ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />}
        </button>
      </div>

      {open && filtered.length > 0 && (
        <div className={styles.modelDropdown}>
          {filtered.map((m) => (
            <button
              key={m.name}
              type="button"
              className={styles.modelOption}
              onMouseDown={(e) => {
                // mousedown fires before blur, so we can select before dropdown closes
                e.preventDefault();
                onChange(m.name);
                setQuery(m.name);
                setOpen(false);
              }}
            >
              <span className={styles.modelName}>{m.name}</span>
              {m.details?.parameter_size && (
                <span className={styles.modelSize}>{m.details.parameter_size}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && models !== null && filtered.length === 0 && (
        <div className={styles.modelDropdown}>
          <p className={styles.modelEmpty}>
            {models.length === 0 ? "No models found in Ollama" : "No matches"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Connection status ─────────────────────────────────────────────────────────

type ConnStatus =
  | null
  | "loading"
  | {
      connected: boolean;
      model: string;
      model_available: boolean;
      model_in_list: boolean;
      error: string | null;
      base_url: string;
    };

function ConnectionStatus({ status }: { status: ConnStatus }) {
  if (!status || status === "loading") return null;

  if (!status.connected) {
    return (
      <span className={styles.connFail}>
        <XCircle size={13} />
        Cannot reach Ollama at {status.base_url}
      </span>
    );
  }
  if (!status.model_in_list) {
    return (
      <span className={styles.connFail}>
        <XCircle size={13} />
        {status.error ?? `Model '${status.model}' not found`}
      </span>
    );
  }
  if (!status.model_available) {
    return (
      <span className={styles.connFail}>
        <XCircle size={13} />
        {status.error ?? `Model '${status.model}' did not respond`}
      </span>
    );
  }
  return (
    <span className={styles.connOk}>
      <CheckCircle size={13} />
      Connected · {status.model} ready
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const THEME_SWATCHES: Record<string, string[]> = {
  zen: ["#f7f6f3", "#4a7c59", "#8b6aa8"],
  "e-ink": ["#ede9de", "#4a7a58", "#7a5a98"],
  nord: ["#ECEFF4", "#5E81AC", "#BF616A"],
  solarized: ["#fdf6e3", "#2aa198", "#dc322f"],
  dracula: ["#282A36", "#50FA7B", "#BD93F9"],
  gruvbox: ["#fbf1c7", "#d65d0e", "#b16286"],
  catppuccin: ["#EFF1F5", "#8839EF", "#C6A0F6"],
};

export default function SettingsPage() {
  const { themeName, colorMode, setThemeName, setColorMode } = useUIStore();
  const studio = useMode() === "studio";
  const { user } = useAuthStore();
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaSaveState, setOllamaSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const ollamaInitialized = useRef(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>(null);

  // LLM parameter settings
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null);
  const [llmTemperature, setLlmTemperature] = useState(1.0);
  const [llmTopP, setLlmTopP] = useState(0.95);
  const [llmTopK, setLlmTopK] = useState(64);
  const [llmThinking, setLlmThinking] = useState(false);
  const [llmTokenBudget, setLlmTokenBudget] = useState<ImageTokenBudget | 0>(0);
  const [llmSaved, setLlmSaved] = useState(false);

  // Store server defaults so we can show them as placeholders
  const [serverDefaults, setServerDefaults] = useState<{ url: string; model: string } | null>(null);

  useEffect(() => {
    api
      .getLLMSettings()
      .then((s) => {
        setLlmSettings(s);
        setLlmTemperature(s.temperature);
        setLlmTopP(s.top_p);
        setLlmTopK(s.top_k);
        setLlmThinking(s.thinking_enabled);
        setLlmTokenBudget(s.image_token_budget ?? 0);
        // Show RAW DB values - empty string if not set
        setOllamaUrl(s.ollama_url ?? "");
        setOllamaModel(s.ollama_model ?? "");
        // Store server defaults for placeholder display
        setServerDefaults({ url: s.effective_ollama_url, model: s.effective_ollama_model });
        ollamaInitialized.current = true;
      })
      .catch(() => {
        ollamaInitialized.current = true;
      });
  }, []);

  // Debounced auto-save when URL or model changes
  useEffect(() => {
    if (!ollamaInitialized.current) return;
    setConnStatus(null); // prior test result is stale when settings change
    const timer = setTimeout(async () => {
      setOllamaSaveState("saving");
      try {
        const updated = await api.updateLLMSettings({
          ollama_url: ollamaUrl.trim() || null,
          ollama_model: ollamaModel.trim() || null,
        });
        setServerDefaults({ url: updated.effective_ollama_url, model: updated.effective_ollama_model });
        setOllamaSaveState("saved");
        setTimeout(() => setOllamaSaveState("idle"), 2000);
      } catch {
        setOllamaSaveState("idle");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [ollamaUrl, ollamaModel]);

  // Auto-save LLM params on change (debounced)
  useEffect(() => {
    if (!llmSettings) return;
    const timer = setTimeout(async () => {
      try {
        await api.updateLLMSettings({
          temperature: llmTemperature,
          top_p: llmTopP,
          top_k: llmTopK,
          thinking_enabled: llmThinking,
          image_token_budget: llmTokenBudget || undefined,
        });
        setLlmSaved(true);
        setTimeout(() => setLlmSaved(false), 1500);
      } catch {
        /* silent */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [llmTemperature, llmTopP, llmTopK, llmThinking, llmTokenBudget]);

  async function resetLlmSettings() {
    const updated = await api.resetLLMSettings();
    setLlmSettings(updated);
    setLlmTemperature(updated.temperature);
    setLlmTopP(updated.top_p);
    setLlmTopK(updated.top_k);
    setLlmThinking(updated.thinking_enabled);
    setLlmTokenBudget(updated.image_token_budget ?? 0);
    setOllamaUrl(updated.ollama_url ?? "");
    setOllamaModel(updated.ollama_model ?? "");
    setServerDefaults({ url: updated.effective_ollama_url, model: updated.effective_ollama_model });
    setConnStatus(null);
  }

  async function testConnection() {
    setConnStatus("loading");
    try {
      const status = await api.ollamaStatus();
      setConnStatus(status);
    } catch {
      setConnStatus({
        connected: false,
        model: "",
        model_available: false,
        model_in_list: false,
        error: null,
        base_url: ollamaUrl,
      });
    }
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

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <div className={styles.layout}>
        <SettingsNav />
        <main className={styles.main}>
          {/* Appearance */}
          <section className={styles.section} id="appearance">
            <h2 className={styles.sectionLabel}>Appearance</h2>

            <ModeToggle />

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
          <section className={styles.section} id="typography">
            <h2 className={styles.sectionLabel}>Typography</h2>
            <TypographySection />
          </section>

          <section className={styles.section} id="shortcuts">
            <h2 className={styles.sectionLabel}>Shortcuts</h2>
            <ShortcutsSection />
          </section>

          {/* LLM Config */}
          {studio && (
            <>
              <section className={styles.section} id="ai">
                <h2 className={styles.sectionLabel}>AI / LLM</h2>
                <AISwitchCard />
                <div className={styles.card}>
                  <div className={styles.field}>
                    <label className={styles.label}>Ollama URL</label>
                    <input
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className={styles.input}
                      placeholder={serverDefaults?.url ?? OLLAMA_URL_DEFAULT}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Model</label>
                    <ModelPicker
                      value={ollamaModel}
                      onChange={(v) => setOllamaModel(v)}
                      placeholder={serverDefaults?.model ?? "e.g. gemma4"}
                    />
                  </div>

                  <div className={styles.connectionRow}>
                    <button
                      className={styles.testBtn}
                      onClick={testConnection}
                      disabled={connStatus === "loading" || ollamaSaveState === "saving"}
                      type="button"
                    >
                      {connStatus === "loading" ? <Loader2 size={13} className={styles.spin} /> : null}
                      {connStatus === "loading" ? "Testing…" : "Test Connection"}
                    </button>
                    {ollamaSaveState === "saving" && (
                      <span className={styles.autoSaving}>
                        <Loader2 size={11} className={styles.spin} /> Saving…
                      </span>
                    )}
                    {ollamaSaveState === "saved" && (
                      <span className={styles.autoSaved}>
                        <Check size={11} /> Saved
                      </span>
                    )}
                    <ConnectionStatus status={connStatus} />
                  </div>

                  <div className={styles.cardFooter}>
                    <button
                      className={styles.resetBtn}
                      onClick={() => {
                        setOllamaUrl("");
                        setOllamaModel("");
                      }}
                      type="button"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
                <Link to="/settings/ai-prompts" className={styles.subpageLink}>
                  AI Prompts
                  <ChevronRight size={14} />
                </Link>
              </section>

              {/* LLM Parameters */}
              <section className={styles.section} id="model-parameters">
                <h2 className={styles.sectionLabel}>Model Parameters</h2>
                <div className={styles.card}>
                  {/* Temperature */}
                  <div className={styles.field}>
                    <label className={styles.label}>Temperature</label>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
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
                        min={0}
                        max={1}
                        step={0.01}
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
                      min={1}
                      max={200}
                      value={llmTopK}
                      onChange={(e) => setLlmTopK(parseInt(e.target.value, 10) || 64)}
                      className={styles.numberInput}
                    />
                    <p className={styles.paramHint}>
                      Limits vocabulary to top-k tokens per step. Gemma 4 default: 64
                    </p>
                  </div>

                  {/* Image token budget */}
                  <div className={styles.field}>
                    <label className={styles.label}>Image Token Budget</label>
                    <select
                      value={llmTokenBudget}
                      onChange={(e) =>
                        setLlmTokenBudget(parseInt(e.target.value, 10) as ImageTokenBudget | 0)
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
                      Controls image resolution when using Gemma 4 multimodal features. Higher budgets use
                      more tokens.
                    </p>
                  </div>

                  {/* Thinking mode */}
                  <div className={styles.toggleRow}>
                    <div className={styles.toggleLabel}>
                      <label className={styles.label}>Thinking Mode</label>
                      <span className={styles.toggleHint}>
                        Gemma 4 reasons before responding. Improves accuracy, increases latency.
                      </span>
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
                    {llmSaved && (
                      <span className={styles.autoSaved}>
                        <Check size={11} /> Saved
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <section className={styles.section} id="codex">
                <h2 className={styles.sectionLabel}>Codex</h2>
                <CodexSection />
              </section>

              {/* Backups */}
            </>
          )}

          <section className={styles.section} id="backups">
            <h2 className={styles.sectionLabel}>Backups</h2>
            <BackupDefaultsCard />
            <DatabaseBackupCard isAdmin={!!user?.is_admin} />
          </section>

          {/* Account */}
          <section className={styles.section} id="privacy">
            <h2 className={styles.sectionLabel}>Privacy</h2>
            <PrivacySection />
          </section>

          <section className={styles.section} id="account">
            <h2 className={styles.sectionLabel}>Account</h2>
            <div className={styles.card}>
              <p className={styles.accountName}>{user?.display_name}</p>
              <p className={styles.accountUsername}>@{user?.username}</p>
              {user?.is_admin && <span className={styles.adminBadge}>Admin</span>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
