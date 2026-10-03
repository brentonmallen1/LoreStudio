import { useState } from "react";
import { Compass, TrendingUp, Map, AlertTriangle, Heart, Lightbulb, XCircle } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import styles from "./ArcAnalysisPanel.module.css";
import { useAIAvailable } from "../../lib/mode";

interface Props {
  characterId: string;
}

type AnyRecord = Record<string, unknown>;

const RATING_LABELS: Record<string, { label: string; className: string }> = {
  needs_work: { label: "Needs work", className: styles.ratingNeedsWork },
  fair: { label: "Fair", className: styles.ratingFair },
  good: { label: "Good", className: styles.ratingGood },
  excellent: { label: "Excellent", className: styles.ratingExcellent },
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

export default function ArcAnalysisPanel({ characterId }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);

  async function analyze() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.analyzeCharacterArc(characterId);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "⚠ Error running arc analysis." });
    } finally {
      setGenerating(false);
    }
  }

  const data = result?.success ? (result.data as AnyRecord) : null;

  if (!aiAvailable) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.icon} />
          <div>
            <h4 className={styles.title}>Arc Analysis</h4>
            <p className={styles.subtitle}>
              AI review of trajectory, drift from planned arc, and development health
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
              <span
                className={`${styles.ratingBadge} ${RATING_LABELS[str(data.overall_rating)]?.className ?? ""}`}
              >
                {RATING_LABELS[str(data.overall_rating)]?.label ?? str(data.overall_rating)}
              </span>
            </div>
          )}

          {/* Trajectory */}
          {!!data.trajectory && (
            <Section icon={<TrendingUp size={12} />} title="Trajectory" color="var(--color-accent)">
              {!!asRecord(data.trajectory).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.trajectory).summary)}</p>
              )}
              {asStringList(asRecord(data.trajectory).details).map((d, i) => (
                <p key={i} className={styles.detailItem}>
                  • {d}
                </p>
              ))}
            </Section>
          )}

          {/* Moment Discoveries */}
          {asList(data.moment_discoveries).length > 0 && (
            <Section icon={<Map size={12} />} title="Key moments found" color="var(--segment-chapter)">
              <p className={styles.sectionSubtitle}>Significant character moments discovered in your prose</p>
              {(asList(data.moment_discoveries) as AnyRecord[]).map((m, i) => (
                <div key={i} className={styles.momentRow}>
                  <div className={styles.momentHeader}>
                    <span className={styles.momentScene}>{str(m.scene_title)}</span>
                    {!!m.suggested_milestone_link && (
                      <span
                        className={styles.milestoneSuggest}
                        title={`Might fulfill: "${str(m.suggested_milestone_link)}"`}
                      >
                        → milestone?
                      </span>
                    )}
                  </div>
                  {!!m.arc_significance && <p className={styles.momentDesc}>{str(m.arc_significance)}</p>}
                </div>
              ))}
            </Section>
          )}

          {/* Drift Analysis */}
          {!!data.drift_analysis && (
            <Section icon={<AlertTriangle size={12} />} title="Drift analysis" color="var(--color-warning)">
              {!!asRecord(data.drift_analysis).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.drift_analysis).summary)}</p>
              )}
              {asStringList(asRecord(data.drift_analysis).details).map((d, i) => (
                <p key={i} className={styles.detailItem}>
                  • {d}
                </p>
              ))}
            </Section>
          )}

          {/* Health */}
          {!!data.health && (
            <Section icon={<Heart size={12} />} title="Arc health" color="var(--color-accent-secondary)">
              {!!asRecord(data.health).summary && (
                <p className={styles.sectionSummary}>{str(asRecord(data.health).summary)}</p>
              )}
              {asStringList(asRecord(data.health).details).map((d, i) => (
                <p key={i} className={styles.detailItem}>
                  • {d}
                </p>
              ))}
            </Section>
          )}

          {/* Unlinked milestones */}
          {asStringList(data.unlinked_milestones).length > 0 && (
            <Section icon={<XCircle size={12} />} title="Unlinked milestones" color="var(--color-danger)">
              <p className={styles.sectionSubtitle}>Milestones with no clear scene fulfilling them yet</p>
              {asStringList(data.unlinked_milestones).map((m, i) => (
                <p key={i} className={styles.warningItem}>
                  <XCircle size={10} /> {m}
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
          Analyze to review arc trajectory, discover key moments, and check alignment with your planned arc.
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
