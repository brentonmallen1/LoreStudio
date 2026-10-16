import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle, ChevronRight, Loader2, RefreshCw, XCircle } from "lucide-react";
import { api } from "../../api/client";
import type { ConnStatus, useModelSettings } from "../../pages/settings/useModelSettings";
import styles from "../../pages/Settings.module.css";

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
          title="List the models Ollama has"
          aria-label="List the models Ollama has"
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

/**
 * Settings › AI / LLM: where Ollama is and which model it runs (doc 30 D4: one plain sentence a
 * field). The values save a moment after a change; Test connection says what it found.
 */
export default function AssistantConnection({ model }: { model: ReturnType<typeof useModelSettings> }) {
  const {
    ollamaUrl,
    setOllamaUrl,
    ollamaModel,
    setOllamaModel,
    ollamaSaveState,
    connStatus,
    testConnection,
    serverDefaults,
  } = model;
  return (
    <>
      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ollama-url">
            Ollama URL
          </label>
          <input
            id="ollama-url"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            className={styles.input}
            placeholder={serverDefaults?.url ?? OLLAMA_URL_DEFAULT}
          />
          <p className={styles.paramHint}>
            Where Ollama listens: leave it empty when Ollama runs on this computer.
          </p>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Model</label>
          <ModelPicker
            value={ollamaModel}
            onChange={(v) => setOllamaModel(v)}
            placeholder={serverDefaults?.model ?? "e.g. gemma4"}
          />
          <p className={styles.paramHint}>
            The model Ollama runs for the Assistant: leave it empty for {serverDefaults?.model ?? "gemma4"},
            or press the button beside it to pick one Ollama has.
          </p>
        </div>

        <div className={styles.connectionRow}>
          <button
            className={styles.testBtn}
            onClick={testConnection}
            disabled={connStatus === "loading" || ollamaSaveState === "saving"}
            type="button"
          >
            {connStatus === "loading" ? <Loader2 size={13} className={styles.spin} /> : null}
            {connStatus === "loading" ? "Testing…" : "Test connection"}
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
        AI prompts
        <ChevronRight size={14} />
      </Link>
    </>
  );
}
