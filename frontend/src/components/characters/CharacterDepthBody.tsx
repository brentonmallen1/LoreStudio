import { CheckCircle, AlertCircle, GitBranch, Users, Lightbulb } from "lucide-react";
import type { CharacterDimensionEntry } from "../../types";
import styles from "./CharacterDimensionalityPanel.module.css";

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
  needs_work: { label: "Needs work", className: styles.ratingNeedsWork },
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

/**
 * The answer as it is kept on the sheet (A6): asked from the header's Assistant menu and
 * shown in the band of kept answers, so it is there when you come back.
 */
export default function CharacterDepthBody({ data }: { data: AnyRecord }) {
  // The response always wraps in a "characters" array; this sheet asked about one.
  const entry = (asList(data.characters) as AnyRecord[])[0] as unknown as CharacterDimensionEntry | undefined;
  if (!entry) return null;
  return (
    <div className={styles.sections}>
      {/* Dimension score + overall rating */}
      <div className={styles.scoreRow}>
        <div className={styles.scorePair}>
          <span className={styles.scoreLabel}>Dimensionality</span>
          <span className={`${styles.scoreBadge} ${DIMENSION_META[entry.dimension_score]?.className ?? ""}`}>
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
        <Section icon={<CheckCircle size={12} />} title="Strengths" color="var(--color-accent-secondary)">
          <ul className={styles.bulletList}>
            {asStringList(entry.strengths).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Gaps */}
      {asStringList(entry.gaps).length > 0 && (
        <Section icon={<AlertCircle size={12} />} title="Gaps" color="var(--color-warning)">
          <ul className={styles.bulletList}>
            {asStringList(entry.gaps).map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Contradictions */}
      {!!entry.contradictions && (
        <Section icon={<GitBranch size={12} />} title="Contradictions & tensions" color="var(--color-ai)">
          <p className={styles.prose}>{entry.contradictions}</p>
        </Section>
      )}

      {/* Relationship depth */}
      {!!entry.relationship_depth && (
        <Section icon={<Users size={12} />} title="Relationship depth" color="var(--segment-chapter)">
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
