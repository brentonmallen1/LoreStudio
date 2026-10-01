import { useState, useEffect, useRef } from "react";
import { Eye, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { api } from "../../../api/client";
import AIModeWrapper from "../AIModeWrapper";
import type { ShowDontTellAnalysisResponse, ShowDontTellInstance } from "../../../types";
import styles from "./ShowDontTellMode.module.css";

interface Props {
  session: AISession;
}

function severityLabel(severity: string): string {
  if (severity === "strong") return "Strong";
  if (severity === "moderate") return "Moderate";
  return "Subtle";
}

function ratingLabel(rating: string): string {
  if (rating === "needs_work") return "Needs work";
  if (rating === "fair") return "Fair";
  if (rating === "good") return "Good";
  return "Excellent";
}

function InstanceCard({ instance }: { instance: ShowDontTellInstance }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.card} ${styles[`sev_${instance.severity}`]}`}>
      <button className={styles.cardHeader} onClick={() => setOpen((o) => !o)}>
        <span className={`${styles.severityBadge} ${styles[`badge_${instance.severity}`]}`}>
          {severityLabel(instance.severity)}
        </span>
        <span className={styles.issueBadge}>{instance.issue_type}</span>
        <span className={styles.passage}>"{instance.passage}"</span>
        <span className={styles.chevron}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && (
        <div className={styles.cardBody}>
          <div className={styles.cardSection}>
            <p className={styles.cardLabel}>Why it's telling</p>
            <p className={styles.cardText}>{instance.explanation}</p>
          </div>
          <div className={styles.cardSection}>
            <p className={styles.cardLabel}>Ask yourself</p>
            <p className={`${styles.cardText} ${styles.suggestion}`}>{instance.question}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShowDontTellMode({ session }: Props) {
  const state = useAIModeState(session);
  const [result, setResult] = useState<ShowDontTellAnalysisResponse | null>(null);
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
      const res = await api.analyzeShowDontTell(storyId, nodeId, selectedText);
      if (res.success && res.data) {
        setResult(res.data as unknown as ShowDontTellAnalysisResponse);
      } else {
        setError(res.raw_text || "Analysis failed. Try again.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
  const strong = result?.instances.filter((i) => i.severity === "strong") ?? [];
  const moderate = result?.instances.filter((i) => i.severity === "moderate") ?? [];
  const subtle = result?.instances.filter((i) => i.severity === "subtle") ?? [];

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Eye}
      title="Show Don't Tell"
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
          <Eye size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Show Don't Tell</p>
          <p className={styles.emptyHint}>
            Select a passage in your scene and click Show/Tell to find opportunities to describe rather than
            state.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loading}>
          <RefreshCw size={18} className={styles.spinner} />
          <p>Analyzing prose…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryBtn} onClick={runAnalysis}>
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className={styles.results}>
          {/* Summary header */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryRow}>
              <span className={`${styles.ratingBadge} ${styles[`rating_${result.overall_rating}`]}`}>
                {ratingLabel(result.overall_rating)}
              </span>
              <span className={styles.instanceCount}>
                {result.instances.length === 0
                  ? "No issues found"
                  : `${result.instances.length} instance${result.instances.length !== 1 ? "s" : ""}`}
              </span>
              <button className={styles.rerunBtn} onClick={runAnalysis} title="Re-run analysis">
                <RefreshCw size={12} />
              </button>
            </div>
            <p className={styles.summaryText}>{result.summary}</p>
            {result.strengths.length > 0 && (
              <ul className={styles.strengths}>
                {result.strengths.map((s, i) => (
                  <li key={i} className={styles.strengthItem}>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* No issues */}
          {result.instances.length === 0 && (
            <div className={styles.noIssues}>
              <Eye size={16} />
              <span>This prose shows well: no telling patterns flagged.</span>
            </div>
          )}

          {/* Instances grouped by severity */}
          {strong.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupLabel}>Strong telling</p>
              {strong.map((inst, i) => (
                <InstanceCard key={i} instance={inst} />
              ))}
            </section>
          )}
          {moderate.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupLabel}>Moderate</p>
              {moderate.map((inst, i) => (
                <InstanceCard key={i} instance={inst} />
              ))}
            </section>
          )}
          {subtle.length > 0 && (
            <section className={styles.group}>
              <p className={styles.groupLabel}>Subtle</p>
              {subtle.map((inst, i) => (
                <InstanceCard key={i} instance={inst} />
              ))}
            </section>
          )}
        </div>
      )}
    </AIModeWrapper>
  );
}
