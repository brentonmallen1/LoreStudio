import type { VoiceFidelityResult } from "../../types";
import styles from "./CharacterDialogueTab.module.css";

function fidelityClass(fidelity: string) {
  if (fidelity === "excellent") return styles.fidelityExcellent;
  if (fidelity === "good") return styles.fidelityGood;
  if (fidelity === "fair") return styles.fidelityFair;
  return styles.fidelityNeedsWork;
}

function severityClass(severity: string) {
  if (severity === "issue") return styles.severityIssue;
  if (severity === "warning") return styles.severityWarning;
  return styles.severityInfo;
}

function clip(text: string, at: number) {
  return text.length > at ? `${text.slice(0, at)}…` : text;
}

/**
 * Voice Fidelity as the Assistant answered it (A7): does their dialogue sound like the person
 * the profile describes. Kept on the character and shown in the sheet's band; it used to sit
 * on the Dialogue view and go when the view changed.
 */
export default function VoiceFidelityBody({ data }: { data: Record<string, unknown> }) {
  const r = data as Partial<VoiceFidelityResult>;
  const findings = (r.findings ?? []).filter((f) => f.severity !== "info");
  const examples = r.authentic_examples ?? [];
  const recommendations = r.recommendations ?? [];
  return (
    <div className={styles.fidelityBody}>
      {r.overall_fidelity && (
        <span className={`${styles.distinctnessBadge} ${fidelityClass(r.overall_fidelity)}`}>
          {r.overall_fidelity.replace("_", " ")}
        </span>
      )}
      {r.attribute_summary && <p className={styles.fidelityAttributeSummary}>{r.attribute_summary}</p>}
      {r.summary && <p className={styles.fidelitySummary}>{r.summary}</p>}

      {findings.length > 0 && (
        <div className={styles.fidelityFindings}>
          {findings.map((finding, i) => (
            <div key={i} className={`${styles.findingRow} ${severityClass(finding.severity)}`}>
              {finding.dialogue_excerpt && (
                <p className={styles.findingExcerpt}>"{clip(finding.dialogue_excerpt, 100)}"</p>
              )}
              <p className={styles.findingExplanation}>{finding.explanation}</p>
              {finding.attribute_context && (
                <p className={styles.findingContext}>{finding.attribute_context}</p>
              )}
              {finding.suggestion && <p className={styles.findingSuggestion}>{finding.suggestion}</p>}
            </div>
          ))}
        </div>
      )}

      {examples.length > 0 && (
        <div className={styles.authenticSection}>
          <p className={styles.similarityTitle}>Lines that ring true</p>
          {examples.slice(0, 4).map((ex, i) => (
            <p key={i} className={styles.authenticExample}>
              "{clip(ex, 100)}"
            </p>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className={styles.fidelityRecommendations}>
          <p className={styles.similarityTitle}>Recommendations</p>
          <ul className={styles.recommendationList}>
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
