import { useState } from "react";
import {
  Orbit,
  Pin,
  BarChart2,
  Eye,
  Shuffle,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./TwistAnalysisPanel.module.css";

interface Props {
  twistId: string;
  onClueLinked?: () => void; // Callback to refresh twist data after linking
}

type AnyRecord = Record<string, unknown>;

const RATING_LABELS: Record<string, { label: string; className: string }> = {
  needs_work: { label: "Needs work", className: styles.ratingNeedsWork },
  fair: { label: "Fair", className: styles.ratingFair },
  good: { label: "Good", className: styles.ratingGood },
  excellent: { label: "Excellent", className: styles.ratingExcellent },
};

const ASSESSMENT_ICONS: Record<string, React.ReactNode> = {
  found: <CheckCircle size={11} className={styles.iconFound} />,
  missing: <XCircle size={11} className={styles.iconMissing} />,
  "needs-work": <AlertCircle size={11} className={styles.iconWarning} />,
};

function str(v: unknown): string {
  return String(v ?? "");
}
function asRecord(v: unknown): AnyRecord {
  return (v as AnyRecord) ?? {};
}
function asList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStringList(v: unknown): string[] {
  return asList(v).map(str);
}

export default function TwistAnalysisPanel({ twistId, onClueLinked }: Props) {
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [linking, setLinking] = useState<string | null>(null); // clue_id being linked

  async function applyClueLink(clueId: string, sceneId: string) {
    if (!clueId || !sceneId) return;
    setLinking(clueId);
    try {
      await api.linkClueToScene(twistId, clueId, sceneId);
      onClueLinked?.();
    } catch {
      // ignore
    } finally {
      setLinking(null);
    }
  }

  async function analyze() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.analyzeTwist(twistId);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "⚠ Error running twist analysis." });
    } finally {
      setGenerating(false);
    }
  }

  const data = result?.success ? (result.data as AnyRecord) : null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Orbit size={13} className={styles.icon} />
          <div>
            <h4 className={styles.title}>Twist Analysis</h4>
            <p className={styles.subtitle}>
              AI review of clue quality, distribution, and reveal effectiveness
            </p>
          </div>
        </div>
        <button
          onClick={analyze}
          disabled={generating}
          className={styles.analyzeBtn}
          title="Review clue quality, foreshadowing distribution, and reveal effectiveness for this twist"
        >
          <Orbit size={12} />
          {generating ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {generating && <p className={styles.hint}>Reading through the story…</p>}

      {!generating && result && !result.success && (
        <p className={styles.hint}>{result.raw_text || "Analysis failed."}</p>
      )}

      {!generating && data && (
        <div className={styles.sections}>
          {/* Overall rating */}
          {!!data.overall_rating && (
            <div className={styles.ratingRow}>
              <span className={styles.ratingLabel}>Overall:</span>
              <span
                className={`${styles.ratingBadge} ${RATING_LABELS[str(data.overall_rating)]?.className ?? ""}`}
              >
                {RATING_LABELS[str(data.overall_rating)]?.label ?? str(data.overall_rating)}
              </span>
            </div>
          )}

          {/* Clue Verification */}
          {!!data.clue_verification && (
            <Section icon={<Pin size={12} />} title="Clue verification" color="var(--color-accent)">
              {!!asRecord(data.clue_verification).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.clue_verification).summary)}</p>
              )}
              {(asList(asRecord(data.clue_verification).details) as AnyRecord[]).map((d, i) => (
                <div key={i} className={styles.clueVerifyRow}>
                  <span className={styles.assessIcon}>
                    {ASSESSMENT_ICONS[str(d.assessment)] ?? <AlertCircle size={11} />}
                  </span>
                  <div className={styles.clueVerifyText}>
                    <span className={styles.clueVerifyClue}>"{str(d.clue_text)}"</span>
                    {!!d.notes && <span className={styles.clueVerifyNotes}>{str(d.notes)}</span>}
                    {!!d.suggested_scene_id && !!d.clue_id && (
                      <div className={styles.clueVerifyLink}>
                        <span className={styles.clueVerifyLinkHint}>→ {str(d.suggested_scene_title)}</span>
                        <button
                          className={styles.linkBtn}
                          disabled={linking === str(d.clue_id)}
                          onClick={() => applyClueLink(str(d.clue_id), str(d.suggested_scene_id))}
                          title={`Link to "${str(d.suggested_scene_title)}"`}
                        >
                          {linking === str(d.clue_id) ? "Linking…" : "Link"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Distribution */}
          {!!data.distribution && (
            <Section icon={<BarChart2 size={12} />} title="Clue distribution" color="var(--twist-accent)">
              {!!asRecord(data.distribution).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.distribution).summary)}</p>
              )}
              <div className={styles.countRow}>
                <span className={styles.countTruth}>
                  {str(asRecord(data.distribution).truth_count ?? 0)} truth
                </span>
                <span className={styles.countMisdirect}>
                  {str(asRecord(data.distribution).misdirection_count ?? 0)} misdirection
                </span>
              </div>
              {asStringList(asRecord(data.distribution).gaps).map((g, i) => (
                <p key={i} className={styles.gapItem}>
                  ⚠ {g}
                </p>
              ))}
            </Section>
          )}

          {/* Reveal */}
          {!!data.reveal && (
            <Section icon={<Eye size={12} />} title="Reveal assessment" color="var(--color-accent-secondary)">
              {!!asRecord(data.reveal).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.reveal).summary)}</p>
              )}
              {asStringList(asRecord(data.reveal).unforeshadowed_elements).length > 0 && (
                <div className={styles.subList}>
                  <span className={styles.subListLabel}>Unforeshadowed:</span>
                  {asStringList(asRecord(data.reveal).unforeshadowed_elements).map((e, i) => (
                    <span key={i} className={styles.warningTag}>
                      {e}
                    </span>
                  ))}
                </div>
              )}
              {asStringList(asRecord(data.reveal).strengths).length > 0 && (
                <div className={styles.subList}>
                  <span className={styles.subListLabel}>Strengths:</span>
                  {asStringList(asRecord(data.reveal).strengths).map((s, i) => (
                    <span key={i} className={styles.strengthTag}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Misdirection Strength */}
          {!!data.misdirection_strength && (
            <Section icon={<Shuffle size={12} />} title="Misdirection strength" color="var(--color-warning)">
              {!!asRecord(data.misdirection_strength).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.misdirection_strength).summary)}</p>
              )}
              {asStringList(asRecord(data.misdirection_strength).suggestions).map((s, i) => (
                <p key={i} className={styles.suggestionItem}>
                  → {s}
                </p>
              ))}
            </Section>
          )}

          {/* Suggestions */}
          {asStringList(data.suggestions).length > 0 && (
            <Section icon={<Lightbulb size={12} />} title="Suggestions" color="var(--segment-beat)">
              <ul className={styles.suggestionList}>
                {asStringList(data.suggestions).map((s, i) => (
                  <li key={i} className={styles.suggestionListItem}>
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {!generating && !result && (
        <p className={styles.hint}>
          Analyze to check clue quality, reveal fairness, and misdirection effectiveness.
        </p>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section} style={{ "--section-color": color } as React.CSSProperties}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} style={{ color }}>
          {icon}
        </span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}
