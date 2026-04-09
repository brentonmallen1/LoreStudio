import { useState } from "react";
import { Compass, TrendingUp, Map, BarChart2, Lightbulb, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./ThreadAnalysisPanel.module.css";

interface Props {
  threadId: string;
}

type AnyRecord = Record<string, unknown>;

const RATING_LABELS: Record<string, { label: string; className: string }> = {
  needs_work: { label: "Needs Work", className: styles.ratingNeedsWork },
  fair:       { label: "Fair",       className: styles.ratingFair },
  good:       { label: "Good",       className: styles.ratingGood },
  excellent:  { label: "Excellent",  className: styles.ratingExcellent },
};

const MOMENT_TYPE_LABELS: Record<string, string> = {
  inciting:      "Inciting",
  complication:  "Complication",
  turning_point: "Turning Point",
  climax:        "Climax",
  resolution:    "Resolution",
};

function str(v: unknown): string { return String(v ?? ""); }
function asRecord(v: unknown): AnyRecord { return (v as AnyRecord) ?? {}; }
function asList(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function asStringList(v: unknown): string[] { return asList(v).map(str); }

export default function ThreadAnalysisPanel({ threadId }: Props) {
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);

  async function analyze() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.analyzeThread(threadId);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "⚠ Error running thread analysis." });
    } finally {
      setGenerating(false);
    }
  }

  const data = result?.success ? (result.data as AnyRecord) : null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.icon} />
          <div>
            <h4 className={styles.title}>Thread Analysis</h4>
            <p className={styles.subtitle}>
              AI review of progression, key moments, and narrative quality
            </p>
          </div>
        </div>
        <button onClick={analyze} disabled={generating} className={styles.analyzeBtn}>
          <Compass size={12} />
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
              <span className={`${styles.ratingBadge} ${RATING_LABELS[str(data.overall_rating)]?.className ?? ""}`}>
                {RATING_LABELS[str(data.overall_rating)]?.label ?? str(data.overall_rating)}
              </span>
            </div>
          )}

          {/* Progression */}
          {!!data.progression && (
            <Section icon={<TrendingUp size={12} />} title="Progression" color="var(--color-accent)">
              {!!asRecord(data.progression).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.progression).summary)}</p>
              )}
              {asStringList(asRecord(data.progression).details).map((d, i) => (
                <p key={i} className={styles.detailItem}>• {d}</p>
              ))}
            </Section>
          )}

          {/* Moment Discoveries */}
          {asList(data.moment_discoveries).length > 0 && (
            <Section icon={<Map size={12} />} title="Key Moments Found" color="var(--segment-chapter, #7c3aed)">
              <p className={styles.sectionSubtitle}>Significant scenes discovered in your prose</p>
              {(asList(data.moment_discoveries) as AnyRecord[]).map((m, i) => (
                <div key={i} className={styles.momentRow}>
                  <div className={styles.momentHeader}>
                    <span className={styles.momentType}>
                      {MOMENT_TYPE_LABELS[str(m.moment_type)] ?? str(m.moment_type)}
                    </span>
                    <span className={styles.momentScene}>{str(m.scene_title)}</span>
                    {!!m.suggested_cycle_link && (
                      <span className={styles.cycleSuggest} title="Consider adding as a try/fail cycle">
                        <CheckCircle size={10} /> cycle?
                      </span>
                    )}
                  </div>
                  {!!m.description && <p className={styles.momentDesc}>{str(m.description)}</p>}
                </div>
              ))}
            </Section>
          )}

          {/* Quality */}
          {!!data.quality && (
            <Section icon={<BarChart2 size={12} />} title="Quality Assessment" color="var(--color-accent-secondary, #0d9488)">
              {!!asRecord(data.quality).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.quality).summary)}</p>
              )}
              {asStringList(asRecord(data.quality).details).map((d, i) => (
                <p key={i} className={styles.detailItem}>• {d}</p>
              ))}
            </Section>
          )}

          {/* Unlinked cycles */}
          {asStringList(data.unlinked_cycles).length > 0 && (
            <Section icon={<AlertCircle size={12} />} title="Unlinked Cycles" color="var(--color-warning, #f59e0b)">
              <p className={styles.sectionSubtitle}>Try/fail cycles with no scene assigned</p>
              {asStringList(data.unlinked_cycles).map((c, i) => (
                <p key={i} className={styles.warningItem}><XCircle size={10} /> {c}</p>
              ))}
            </Section>
          )}

          {/* Suggestions */}
          {asStringList(data.suggestions).length > 0 && (
            <Section icon={<Lightbulb size={12} />} title="Suggestions" color="var(--segment-beat, #a855f7)">
              <ul className={styles.suggestionList}>
                {asStringList(data.suggestions).map((s, i) => (
                  <li key={i} className={styles.suggestionListItem}>{s}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {!generating && !result && (
        <p className={styles.hint}>
          Analyze to review thread progression, discover key moments, and assess narrative quality.
        </p>
      )}
    </div>
  );
}

function Section({ icon, title, color, children }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section} style={{ borderLeftColor: color }}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} style={{ color }}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}
