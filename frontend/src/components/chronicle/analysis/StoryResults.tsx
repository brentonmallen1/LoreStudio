import { AlertTriangle, User, BookOpen, XCircle, MinusCircle } from "lucide-react";
import type {
  StructuredResult,
  ContinuityCheckResult,
  ThemeTrackerResult,
  PlotHoleDetectionResult,
} from "../../../types";
import StructuredResponseRenderer from "../../ai/StructuredResponseRenderer";
import { FIRST_PASS_SCHEMA } from "./schemas";
import styles from "./Analysis.module.css";

/** Assistant story checks read back in the Chronicle: compass, continuity, themes, plot holes, first pass. */

// ── Essential questions renderer ──────────────────────────────────────────────

const QUESTION_KEYS = ["protagonist", "want", "why", "obstacle", "stakes", "change"] as const;
const QUESTION_LABELS: Record<string, string> = {
  protagonist: "Who is the protagonist?",
  want: "What do they want?",
  why: "Why do they want it?",
  obstacle: "What's stopping them?",
  stakes: "What's at stake?",
  change: "How do they change?",
};
const STATUS_COLOR: Record<string, string> = {
  clear: "var(--color-success)",
  partial: "var(--color-warning)",
  unclear: "var(--color-danger)",
};

export function EssentialQuestionsDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data) {
    return <p className={styles.empty}>{result.raw_text}</p>;
  }
  const data = result.data as Record<string, { status: string; evidence: string; recommendation: string }>;
  return (
    <div className={styles.eqGrid}>
      {QUESTION_KEYS.map((key) => {
        const q = data[key];
        if (!q) return null;
        return (
          <div key={key} className={styles.eqRow}>
            <div className={styles.eqLabel}>
              <span
                className={styles.eqDot}
                style={{ background: STATUS_COLOR[q.status] ?? "var(--color-text-muted)" }}
              />
              {QUESTION_LABELS[key]}
            </div>
            <p className={styles.eqEvidence}>{q.evidence}</p>
            {q.recommendation && q.status !== "clear" && <p className={styles.eqRec}>{q.recommendation}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Continuity result renderer ────────────────────────────────────────────────

const SEVERITY_ICON: Record<string, React.ElementType> = {
  critical: XCircle,
  moderate: AlertTriangle,
  minor: MinusCircle,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--color-danger)",
  moderate: "var(--color-warning)",
  minor: "var(--color-text-muted)",
};

export function ContinuityResultDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as ContinuityCheckResult;
  const issues = data.issues ?? [];
  return (
    <div className={styles.aiResults}>
      {data.summary && <p className={styles.aiSummary}>{data.summary}</p>}
      {issues.length === 0 ? (
        <p className={styles.empty} style={{ color: "var(--color-success)" }}>
          No continuity issues found.
        </p>
      ) : (
        issues.map((issue, i) => {
          const SevIcon = SEVERITY_ICON[issue.severity] ?? MinusCircle;
          return (
            <div key={i} className={styles.issueRow}>
              <SevIcon
                size={12}
                style={{ color: SEVERITY_COLOR[issue.severity], flexShrink: 0, marginTop: 2 }}
              />
              <div className={styles.issueBody}>
                <span className={styles.issueLabel}>{issue.description}</span>
                {issue.scene_references.length > 0 && (
                  <span className={styles.issueMeta}>{issue.scene_references.join(" · ")}</span>
                )}
                <p className={styles.issueDetail}>{issue.explanation}</p>
                {issue.suggestion && <p className={styles.issueSuggestion}>{issue.suggestion}</p>}
              </div>
            </div>
          );
        })
      )}
      {(data.timeline_notes?.length > 0 || data.character_notes?.length > 0) && (
        <div className={styles.notesSection}>
          {data.timeline_notes?.map((n, i) => (
            <p key={i} className={styles.note}>
              <BookOpen size={10} /> {n}
            </p>
          ))}
          {data.character_notes?.map((n, i) => (
            <p key={i} className={styles.note}>
              <User size={10} /> {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Theme tracker renderer ────────────────────────────────────────────────────

const STRENGTH_COLOR: Record<string, string> = {
  well_developed: "var(--color-success)",
  present: "var(--color-accent)",
  emerging: "var(--color-text-muted)",
};

export function ThemeResultDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as ThemeTrackerResult;
  return (
    <div className={styles.aiResults}>
      {data.thematic_arc && <p className={styles.aiSummary}>{data.thematic_arc}</p>}
      {(data.themes ?? []).map((theme, i) => (
        <div key={i} className={styles.themeRow}>
          <div className={styles.themeHeader}>
            <span
              className={styles.themeDot}
              style={{ background: STRENGTH_COLOR[theme.strength] ?? "var(--color-text-muted)" }}
            />
            <span className={styles.themeName}>{theme.name}</span>
            <span className={styles.themeMeta}>{theme.strength.replace("_", " ")}</span>
          </div>
          <p className={styles.themeDesc}>{theme.description}</p>
          {theme.scenes.length > 0 && <p className={styles.issueMeta}>{theme.scenes.join(" · ")}</p>}
        </div>
      ))}
      {data.motifs?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Motifs</span>
          {data.motifs.map((m, i) => (
            <p key={i} className={styles.note}>
              {m}
            </p>
          ))}
        </div>
      )}
      {data.gaps?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Thematic gaps</span>
          {data.gaps.map((g, i) => (
            <p key={i} className={styles.note}>
              {g}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Plot holes renderer ───────────────────────────────────────────────────────

export function PlotHolesResultDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as PlotHoleDetectionResult;
  const holes = data.holes ?? [];
  return (
    <div className={styles.aiResults}>
      {data.summary && <p className={styles.aiSummary}>{data.summary}</p>}
      {holes.length === 0 ? (
        <p className={styles.empty} style={{ color: "var(--color-success)" }}>
          No plot holes detected.
        </p>
      ) : (
        holes.map((hole, i) => {
          const SevIcon = SEVERITY_ICON[hole.severity] ?? MinusCircle;
          return (
            <div key={i} className={styles.issueRow}>
              <SevIcon
                size={12}
                style={{ color: SEVERITY_COLOR[hole.severity], flexShrink: 0, marginTop: 2 }}
              />
              <div className={styles.issueBody}>
                <span className={styles.issueLabel}>{hole.description}</span>
                {hole.scene_references.length > 0 && (
                  <span className={styles.issueMeta}>{hole.scene_references.join(" · ")}</span>
                )}
                <p className={styles.issueDetail}>{hole.explanation}</p>
                {hole.suggestion && <p className={styles.issueSuggestion}>{hole.suggestion}</p>}
              </div>
            </div>
          );
        })
      )}
      {data.logic_gaps?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Logic gaps</span>
          {data.logic_gaps.map((g, i) => (
            <p key={i} className={styles.note}>
              {g}
            </p>
          ))}
        </div>
      )}
      {data.unanswered_questions?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Unanswered questions</span>
          {data.unanswered_questions.map((q, i) => (
            <p key={i} className={styles.note}>
              {q}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── First-pass renderer ───────────────────────────────────────────────────────

function FirstPassGapsDisplay({
  gaps,
}: {
  gaps: Array<{
    area: string;
    finding: string;
    severity: string;
    scene_references: string[];
    suggestion: string;
  }>;
}) {
  if (!gaps || gaps.length === 0) return null;
  return (
    <div className={styles.checkGroup}>
      <span className={styles.checkLabel}>Intent gaps ({gaps.length})</span>
      {gaps.map((gap, i) => {
        const SevIcon = SEVERITY_ICON[gap.severity] ?? MinusCircle;
        return (
          <div key={i} className={styles.issueRow}>
            <SevIcon size={12} style={{ color: SEVERITY_COLOR[gap.severity], flexShrink: 0, marginTop: 2 }} />
            <div className={styles.issueBody}>
              <span className={styles.issueLabel}>
                [{gap.area}] {gap.finding}
              </span>
              {gap.scene_references.length > 0 && (
                <span className={styles.issueMeta}>{gap.scene_references.join(" · ")}</span>
              )}
              {gap.suggestion && <p className={styles.issueSuggestion}>{gap.suggestion}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FirstPassResultDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const gaps =
    ((result.data as Record<string, unknown>).gaps as Array<{
      area: string;
      finding: string;
      severity: string;
      scene_references: string[];
      suggestion: string;
    }>) ?? [];
  return (
    <div>
      <StructuredResponseRenderer result={result} schema={FIRST_PASS_SCHEMA} />
      <FirstPassGapsDisplay gaps={gaps} />
    </div>
  );
}
