import { useState, useEffect, useRef } from "react";
import { Users, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { api } from "../../../api/client";
import AIModeWrapper from "../AIModeWrapper";
import type { AudienceAdherenceResponse, AudienceIssue } from "../../../types";
import styles from "./AudienceAdherenceMode.module.css";

interface Props {
  session: AISession;
}

function fitLabel(fit: string): string {
  if (fit === "poor") return "Poor fit";
  if (fit === "fair") return "Fair";
  if (fit === "good") return "Good fit";
  return "Excellent fit";
}

function IssueCard({ issue }: { issue: AudienceIssue }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.card} ${styles[`sev_${issue.severity}`]}`}>
      <button className={styles.cardHeader} onClick={() => setOpen((o) => !o)}>
        <span className={`${styles.severityBadge} ${styles[`badge_${issue.severity}`]}`}>
          {issue.severity}
        </span>
        <span className={styles.issueBadge}>{issue.issue_type}</span>
        <span className={styles.passage}>"{issue.passage}"</span>
        <span className={styles.chevron}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && (
        <div className={styles.cardBody}>
          <div className={styles.cardSection}>
            <p className={styles.cardLabel}>Issue</p>
            <p className={styles.cardText}>{issue.explanation}</p>
          </div>
          <div className={styles.cardSection}>
            <p className={styles.cardLabel}>Suggestion</p>
            <p className={`${styles.cardText} ${styles.suggestion}`}>{issue.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AudienceAdherenceMode({ session }: Props) {
  const state = useAIModeState(session);
  const [result, setResult] = useState<AudienceAdherenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  const { storyId, nodeId, selectedText } = session.context;

  async function runAnalysis() {
    if (!storyId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.analyzeAudienceAdherence(storyId, nodeId, selectedText);
      if (res.success && res.data) {
        setResult(res.data as unknown as AudienceAdherenceResponse);
      } else {
        setError(res.raw_text || "Analysis failed. Try again.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      // Backend returns 422 if no target audience is set
      if (msg.includes("422") || msg.toLowerCase().includes("no target audience")) {
        setError("No target audience set. Add one in the story's Lorebook first.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on mount when there's text to analyze
  useEffect(() => {
    if (ranRef.current) return;
    if (!storyId) return;
    if (!nodeId && !selectedText) return;
    ranRef.current = true;
    runAnalysis();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent = !!selectedText || !!nodeId;
  const critical = result?.issues.filter((i) => i.severity === "critical") ?? [];
  const moderate = result?.issues.filter((i) => i.severity === "moderate") ?? [];
  const minor = result?.issues.filter((i) => i.severity === "minor") ?? [];

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Users}
      title="Audience Fit"
      hideTokenBadge
      hideSettings
      headerExtra={
        selectedText && (
          <span className={styles.passageChip} title={selectedText}>
            "{selectedText.length > 40 ? selectedText.slice(0, 40) + "…" : selectedText}"
          </span>
        )
      }
    >
      {/* Empty state */}
      {!hasContent && !loading && (
        <div className={styles.empty}>
          <Users size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Audience Fit</p>
          <p className={styles.emptyHint}>
            Select a passage and click Audience, or open this tool with a scene loaded, to check how well your
            prose matches its target audience.
          </p>
          <p className={styles.emptyHint}>Set a target audience in the story's Lorebook first.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loading}>
          <RefreshCw size={18} className={styles.spinner} />
          <p>Checking audience fit…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          {!error.includes("Lorebook") && (
            <button className={styles.retryBtn} onClick={runAnalysis}>
              Try again
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className={styles.results}>
          {/* Summary header */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryRow}>
              <span className={`${styles.fitBadge} ${styles[`fit_${result.overall_fit}`]}`}>
                {fitLabel(result.overall_fit)}
              </span>
              <span className={styles.audienceLabel}>{result.target_audience}</span>
              <span className={styles.issueCount}>
                {result.issues.length === 0
                  ? "No issues"
                  : `${result.issues.length} issue${result.issues.length !== 1 ? "s" : ""}`}
              </span>
              <button
                className={styles.rerunBtn}
                onClick={runAnalysis}
                title="Re-run analysis"
                aria-label="Re-run analysis"
              >
                <RefreshCw size={12} />
              </button>
            </div>
            <p className={styles.summaryText}>{result.summary}</p>
          </div>

          {/* Assessments */}
          <div className={styles.assessments}>
            {result.vocabulary_assessment && (
              <div className={styles.assessment}>
                <p className={styles.assessmentLabel}>Vocabulary</p>
                <p className={styles.assessmentText}>{result.vocabulary_assessment}</p>
              </div>
            )}
            {result.content_assessment && (
              <div className={styles.assessment}>
                <p className={styles.assessmentLabel}>Content</p>
                <p className={styles.assessmentText}>{result.content_assessment}</p>
              </div>
            )}
            {result.theme_assessment && (
              <div className={styles.assessment}>
                <p className={styles.assessmentLabel}>Themes</p>
                <p className={styles.assessmentText}>{result.theme_assessment}</p>
              </div>
            )}
          </div>

          {/* No issues */}
          {result.issues.length === 0 && (
            <div className={styles.noIssues}>
              <Users size={16} />
              <span>Prose is well-matched to its target audience.</span>
            </div>
          )}

          {/* Issues grouped by severity */}
          {critical.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupLabel}>Critical</p>
              {critical.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </section>
          )}
          {moderate.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupLabel}>Moderate</p>
              {moderate.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </section>
          )}
          {minor.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupLabel}>Minor</p>
              {minor.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </section>
          )}
        </div>
      )}
    </AIModeWrapper>
  );
}
