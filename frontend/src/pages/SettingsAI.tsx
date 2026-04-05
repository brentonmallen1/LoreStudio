import { useState, useEffect } from "react";
import { RotateCcw, ChevronDown, ChevronRight, Info, Copy, Check, X } from "lucide-react";
import { api } from "../api/client";
import type { AISettings, AISettingsDefaults } from "../types";
import styles from "./SettingsAI.module.css";

interface DefaultPromptModalProps {
  label: string;
  prompt: string;
  onClose: () => void;
}

function DefaultPromptModal({ label, prompt, onClose }: DefaultPromptModalProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Default: {label}</span>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <p className={styles.modalNote}>
          Story and character context is automatically prepended at runtime. This is the behavioral instruction portion.
        </p>
        <pre className={styles.modalPrompt}>{prompt}</pre>
        <div className={styles.modalActions}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsAIPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [defaults, setDefaults] = useState<AISettingsDefaults | null>(null);
  const [corePrompt, setCorePrompt] = useState("");
  const [featureEdits, setFeatureEdits] = useState<Record<string, string>>({});
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [defaultModal, setDefaultModal] = useState<{ featureId: string; label: string } | null>(null);

  useEffect(() => {
    Promise.all([api.getAISettings(), api.getAISettingsDefaults()])
      .then(([s, d]) => {
        setSettings(s);
        setDefaults(d);
        setCorePrompt(s.core_prompt);
        const edits: Record<string, string> = {};
        for (const [id] of Object.entries(d.feature_labels)) {
          edits[id] = s.feature_prompts[id] ?? "";
        }
        setFeatureEdits(edits);
      })
      .finally(() => setLoading(false));
  }, []);

  function flash(key: string) {
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  async function saveCorePrompt() {
    setSaving("core");
    try {
      const updated = await api.updateAISettings({ core_prompt: corePrompt });
      setSettings(updated);
      flash("core");
    } finally {
      setSaving(null);
    }
  }

  async function resetCore() {
    setSaving("core-reset");
    try {
      const updated = await api.resetCorePrompt();
      setSettings(updated);
      setCorePrompt(updated.core_prompt);
      flash("core");
    } finally {
      setSaving(null);
    }
  }

  async function saveFeaturePrompt(featureId: string) {
    setSaving(featureId);
    const value = featureEdits[featureId];
    const fp: Record<string, string | null> = { [featureId]: value.trim() || null };
    try {
      const updated = await api.updateAISettings({ feature_prompts: fp });
      setSettings(updated);
      flash(featureId);
    } finally {
      setSaving(null);
    }
  }

  async function resetFeaturePrompt(featureId: string) {
    setSaving(`${featureId}-reset`);
    try {
      const updated = await api.resetFeaturePrompt(featureId);
      setSettings(updated);
      setFeatureEdits((prev) => ({ ...prev, [featureId]: "" }));
      flash(featureId);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>AI Prompts</h1>
        <div className={styles.main}>
          <p className={styles.loadingText}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>AI Prompts</h1>

      <main className={styles.main}>
        <p className={styles.intro}>
          These prompts control how LoreStudio's AI behaves. The core prompt is always included.
          Feature prompts are appended for specific interactions. Leave a feature prompt blank to use the built-in default.
        </p>

        {/* Core Prompt */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionLabel}>Core System Prompt</h2>
            {settings?.core_prompt_is_custom && (
              <span className={styles.customBadge}>Custom</span>
            )}
          </div>
          <p className={styles.sectionDesc}>
            Always sent with every AI request. Sets the overall tone and expectations.
          </p>
          <div className={styles.card}>
            <textarea
              className={styles.textarea}
              value={corePrompt}
              onChange={(e) => setCorePrompt(e.target.value)}
              rows={10}
              spellCheck={false}
            />
            <div className={styles.actions}>
              <button
                className={styles.resetBtn}
                onClick={resetCore}
                disabled={saving !== null || !settings?.core_prompt_is_custom}
                title="Reset to default"
              >
                <RotateCcw size={13} />
                Reset to default
              </button>
              <button
                className={styles.saveBtn}
                onClick={saveCorePrompt}
                disabled={saving !== null}
              >
                {saved === "core" ? "Saved" : saving === "core" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>

        {/* Feature Prompts */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Feature Prompts</h2>
          <p className={styles.sectionDesc}>
            Appended to the core prompt for specific features. Leave blank to use the built-in default.
          </p>

          <div className={styles.featureList}>
            {defaults && Object.entries(defaults.feature_labels).map(([featureId, label]) => {
              const isExpanded = expandedFeature === featureId;
              const isCustom = Boolean(settings?.feature_prompts[featureId]);
              const currentValue = featureEdits[featureId] ?? "";
              const hasDefault = Boolean(defaults.feature_defaults[featureId]);

              return (
                <div key={featureId} className={styles.featureItem}>
                  <button
                    className={styles.featureHeader}
                    onClick={() => setExpandedFeature(isExpanded ? null : featureId)}
                  >
                    <span className={styles.featureChevron}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className={styles.featureLabel}>{label}</span>
                    {isCustom && <span className={styles.customBadge}>Custom</span>}
                    {hasDefault && (
                      <span
                        className={styles.infoBtn}
                        role="button"
                        tabIndex={0}
                        title="View default prompt"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDefaultModal({ featureId, label });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            setDefaultModal({ featureId, label });
                          }
                        }}
                      >
                        <Info size={13} />
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className={styles.featureBody}>
                      <textarea
                        className={styles.textarea}
                        value={currentValue}
                        onChange={(e) => setFeatureEdits((prev) => ({ ...prev, [featureId]: e.target.value }))}
                        rows={6}
                        placeholder="Leave blank to use the built-in default prompt…"
                        spellCheck={false}
                      />
                      <div className={styles.actions}>
                        <button
                          className={styles.resetBtn}
                          onClick={() => resetFeaturePrompt(featureId)}
                          disabled={saving !== null || !isCustom}
                          title="Reset to default"
                        >
                          <RotateCcw size={13} />
                          Reset to default
                        </button>
                        <button
                          className={styles.saveBtn}
                          onClick={() => saveFeaturePrompt(featureId)}
                          disabled={saving !== null}
                        >
                          {saved === featureId
                            ? "Saved"
                            : saving === featureId
                            ? "Saving…"
                            : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {defaultModal && defaults?.feature_defaults[defaultModal.featureId] && (
        <DefaultPromptModal
          label={defaultModal.label}
          prompt={defaults.feature_defaults[defaultModal.featureId]}
          onClose={() => setDefaultModal(null)}
        />
      )}
    </div>
  );
}
