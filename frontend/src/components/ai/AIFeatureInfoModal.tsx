import { useEffect, useState } from "react";
import { Cpu, ExternalLink, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../common";
import { api } from "../../api/client";
import type { AISettings } from "../../types";
import { PAGE_LABELS, visibleFeatures } from "../../lib/ai/featureRegistry";
import { useMode } from "../../lib/mode";
import type { AIFeatureInfo } from "../../lib/ai/featureRegistry";
import styles from "./AIFeatureInfoModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
}

export default function AIFeatureInfoModal({ isOpen, onClose, pageId }: Props) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    api
      .getAISettings()
      .then(setSettings)
      .catch(() => {});
  }, [isOpen]);

  // Writer mode sees the NLP tools it can actually run, and nothing about the AI ones.
  const allFeatures = visibleFeatures(pageId, useMode());

  const nlpFeatures = allFeatures.filter((f) => f.type === "nlp");
  const aiFeatures = allFeatures.filter((f) => f.type === "ai");

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getPrompt(feature: AIFeatureInfo): { text: string; isCustom: boolean } | null {
    if (!feature.backendFeatureId || !settings) return null;
    const custom = settings.feature_prompts[feature.backendFeatureId];
    if (custom) return { text: custom, isCustom: true };
    return null;
  }

  const pageLabel = PAGE_LABELS[pageId] ?? pageId;

  const footer = (
    <button
      className={styles.settingsLink}
      onClick={() => {
        onClose();
        navigate("/settings/ai-prompts");
      }}
    >
      <Settings size={13} />
      Customize prompts in Settings
      <ExternalLink size={11} />
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${pageLabel}: AI & NLP Features`}
      icon={<Cpu size={15} />}
      size="lg"
      footer={footer}
    >
      <div className={styles.content}>
        {allFeatures.length === 0 && (
          <p className={styles.empty}>No AI or NLP features registered for this page.</p>
        )}

        {nlpFeatures.length > 0 && (
          <section className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.groupDot} style={{ background: "var(--color-nlp)" }} />
              <span className={styles.groupLabel}>Local NLP: fast, no AI required</span>
            </div>
            {nlpFeatures.map((f) => (
              <FeatureCard
                key={f.id}
                feature={f}
                prompt={getPrompt(f)}
                expanded={expandedIds.has(f.id)}
                onToggle={() => toggleExpand(f.id)}
              />
            ))}
          </section>
        )}

        {aiFeatures.length > 0 && (
          <section className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.groupDot} style={{ background: "var(--color-ai)" }} />
              <span className={styles.groupLabel}>AI: requires Ollama</span>
            </div>
            {aiFeatures.map((f) => (
              <FeatureCard
                key={f.id}
                feature={f}
                prompt={getPrompt(f)}
                expanded={expandedIds.has(f.id)}
                onToggle={() => toggleExpand(f.id)}
              />
            ))}
          </section>
        )}
      </div>
    </Modal>
  );
}

interface CardProps {
  feature: AIFeatureInfo;
  prompt: { text: string; isCustom: boolean } | null;
  expanded: boolean;
  onToggle: () => void;
}

function FeatureCard({ feature, prompt, expanded, onToggle }: CardProps) {
  const typeColor = feature.type === "nlp" ? "var(--color-nlp)" : "var(--color-ai)";

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <span className={styles.cardBadge} style={{ color: typeColor, borderColor: typeColor }}>
            {feature.type === "nlp" ? "NLP" : "AI"}
          </span>
          <span className={styles.cardLabel}>{feature.label}</span>
          {prompt?.isCustom && <span className={styles.customBadge}>customized</span>}
        </div>
        <button
          className={styles.cardToggle}
          onClick={onToggle}
          title={expanded ? "Hide details" : "Show prompt & context details"}
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      <p className={styles.cardDesc}>{feature.fullDescription}</p>

      {expanded && (
        <div className={styles.cardDetails}>
          <div className={styles.detailSection}>
            <span className={styles.detailLabel}>Context used</span>
            <ul className={styles.sourceList}>
              {feature.contextSources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>

          {feature.type === "ai" && (
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>
                Behavioral prompt
                {feature.backendFeatureId ? null : (
                  <span className={styles.noPromptNote}> (built into the feature, not customizable)</span>
                )}
              </span>
              {prompt ? (
                <pre className={styles.promptText}>{prompt.text}</pre>
              ) : feature.backendFeatureId ? (
                <p className={styles.defaultNote}>
                  Using the default prompt.{" "}
                  <span className={styles.settingsHint}>Customize in Settings → AI.</span>
                </p>
              ) : (
                <p className={styles.defaultNote}>
                  This feature uses a dynamically constructed prompt based on the selected context.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
