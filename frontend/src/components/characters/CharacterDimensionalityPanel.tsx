import { useState } from "react";
import { Compass, CheckCircle, AlertCircle, GitBranch, Users, Lightbulb } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult, CharacterDimensionEntry } from "../../types";
import styles from "./CharacterDimensionalityPanel.module.css";
import { useAIAvailable } from "../../lib/mode";

interface Props {
  characterId: string;
}

type AnyRecord = Record<string, unknown>;

function str(v: unknown): string {
  return String(v ?? "");
}
function asList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStringList(v: unknown): string[] {
  return asList(v).map(str);
}

const RATING_LABELS: Record<string, { label: string; className: string }> = {
  needs_work: { label: "Needs Work", className: styles.ratingNeedsWork },
  fair: { label: "Fair", className: styles.ratingFair },
  good: { label: "Good", className: styles.ratingGood },
  excellent: { label: "Excellent", className: styles.ratingExcellent },
};

const DIMENSION_META: Record<string, { label: string; className: string }> = {
  flat: { label: "Flat", className: styles.scoreFlat },
  developing: { label: "Developing", className: styles.scoreDeveloping },
  dimensional: { label: "Dimensional", className: styles.scoreDimensional },
  complex: { label: "Complex", className: styles.scoreComplex },
};

export default function CharacterDimensionalityPanel({ characterId }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);

  async function analyze() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.assessCharacterDimensionality(characterId);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "⚠ Error running dimensionality assessment." });
    } finally {
      setGenerating(false);
    }
  }

  const data = result?.success ? (result.data as AnyRecord) : null;
  // The response always wraps in a "characters" array; grab the first entry
  const chars = asList(data?.characters) as AnyRecord[];
  const entry = chars[0] as unknown as CharacterDimensionEntry | undefined;

  if (!aiAvailable) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.icon} />
          <div>
            <h4 className={styles.title}>Character Depth</h4>
            <p className={styles.subtitle}>
              AI assessment of dimensionality, contradictions, and development
            </p>
          </div>
        </div>
        <button onClick={analyze} disabled={generating} className={styles.analyzeBtn}>
          <Compass size={12} />
          {generating ? "Assessing…" : result ? "Re-assess" : "Assess"}
        </button>
      </div>

      {generating && <p className={styles.hint}>Examining the character…</p>}

      {!generating && result && !result.success && (
        <p className={styles.hint}>{result.raw_text || "Assessment failed."}</p>
      )}

      {!generating && data && entry && (
        <div className={styles.sections}>
          {/* Dimension score + overall rating */}
          <div className={styles.scoreRow}>
            <div className={styles.scorePair}>
              <span className={styles.scoreLabel}>Dimensionality</span>
              <span
                className={`${styles.scoreBadge} ${DIMENSION_META[entry.dimension_score]?.className ?? ""}`}
              >
                {DIMENSION_META[entry.dimension_score]?.label ?? entry.dimension_score}
              </span>
            </div>
            {!!data.overall_rating && (
              <div className={styles.scorePair}>
                <span className={styles.scoreLabel}>Rating</span>
                <span
                  className={`${styles.ratingBadge} ${RATING_LABELS[str(data.overall_rating)]?.className ?? ""}`}
                >
                  {RATING_LABELS[str(data.overall_rating)]?.label ?? str(data.overall_rating)}
                </span>
              </div>
            )}
          </div>

          {/* Strengths */}
          {asStringList(entry.strengths).length > 0 && (
            <Section
              icon={<CheckCircle size={12} />}
              title="Strengths"
              color="var(--color-accent-secondary, #0d9488)"
            >
              <ul className={styles.bulletList}>
                {asStringList(entry.strengths).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Gaps */}
          {asStringList(entry.gaps).length > 0 && (
            <Section icon={<AlertCircle size={12} />} title="Gaps" color="var(--color-warning, #f59e0b)">
              <ul className={styles.bulletList}>
                {asStringList(entry.gaps).map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Contradictions */}
          {!!entry.contradictions && (
            <Section icon={<GitBranch size={12} />} title="Contradictions & Tensions" color="var(--color-ai)">
              <p className={styles.prose}>{entry.contradictions}</p>
            </Section>
          )}

          {/* Relationship depth */}
          {!!entry.relationship_depth && (
            <Section
              icon={<Users size={12} />}
              title="Relationship Depth"
              color="var(--segment-chapter, #7c3aed)"
            >
              <p className={styles.prose}>{entry.relationship_depth}</p>
            </Section>
          )}

          {/* Recommendations */}
          {asStringList(entry.recommendations).length > 0 && (
            <Section icon={<Lightbulb size={12} />} title="Recommendations" color="var(--color-ai)">
              <ul className={styles.recommendList}>
                {asStringList(entry.recommendations).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {!generating && !result && (
        <p className={styles.hint}>
          Assess to get a read on this character's dimensionality, internal tensions, and how they might be
          deepened.
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
    <div className={styles.section} style={{ borderLeftColor: color }}>
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
