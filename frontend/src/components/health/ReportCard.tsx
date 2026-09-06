import { useState } from "react";
import {
  AlignLeft,
  HelpCircle,
  Search,
  FileCheck,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
  User,
  MapPin,
  BarChart3,
  Activity,
  RefreshCw,
  Lightbulb,
  GitMerge,
  Palette,
  Skull,
  BookOpen,
  CheckCircle,
  XCircle,
  MinusCircle,
  ClipboardCheck,
  Star,
  TrendingUp,
  Volume2,
  Repeat2,
  Users,
  UserCheck,
} from "lucide-react";
import type {
  ActivityLog,
  ProseNLPResponse,
  EntitySuggestionsResponse,
  StructuredResult,
  EditorialConsistencyResponse,
  ContinuityCheckResult,
  ThemeTrackerResult,
  PlotHoleDetectionResult,
  ClicheAnalysisResponse,
  ClicheInstance,
  CharacterDimensionEntry,
  CharacterDimensionalityResult,
  VoiceFidelityResult,
  VoiceFidelityFinding,
} from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import AskAboutAnalysis from "./AskAboutAnalysis";
import styles from "./ReportCard.module.css";

// ── Feature metadata ──────────────────────────────────────────────────────────

const FEATURE_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  "prose-analysis": { label: "Prose Analysis", Icon: AlignLeft, color: "var(--color-nlp)" },
  "editorial-consistency": { label: "Editorial Check", Icon: FileCheck, color: "var(--color-nlp)" },
  "economy-analysis": { label: "Economy Analysis", Icon: BarChart3, color: "var(--color-ai)" },
  "essential-questions": { label: "Story Compass", Icon: HelpCircle, color: "var(--color-ai)" },
  "entity-suggestions": { label: "Lorebook Scan", Icon: Search, color: "var(--color-nlp)" },
  "pacing-analysis": { label: "Pacing Analysis", Icon: Activity, color: "var(--color-ai)" },
  "continuity-check": { label: "Continuity Check", Icon: GitMerge, color: "var(--color-ai)" },
  "theme-tracker": { label: "Theme Tracker", Icon: Palette, color: "var(--color-ai)" },
  "plot-holes": { label: "Plot Holes", Icon: Skull, color: "var(--color-ai)" },
  "first-pass": { label: "First-Pass Editor", Icon: ClipboardCheck, color: "var(--color-ai)" },
  "cliche-analysis": { label: "Cliche Check", Icon: Repeat2, color: "var(--color-ai)" },
  "character-dimensionality": { label: "Character Depth", Icon: Users, color: "var(--color-ai)" },
  "voice-fidelity": { label: "Voice Fidelity", Icon: UserCheck, color: "var(--color-ai)" },
};

// ── Economy schema (mirrors EconomyAnalysisPanel) ─────────────────────────────

const ECONOMY_SCHEMA: SectionConfig[] = [
  { key: "thread_balance", label: "Thread Balance", icon: BarChart3, color: "var(--color-ai)", type: "text" },
  {
    key: "scene_economy",
    label: "Scene Economy",
    icon: Activity,
    color: "var(--color-warning)",
    type: "text",
  },
  {
    key: "try_fail_cycles",
    label: "Try/Fail Cycles",
    icon: RefreshCw,
    color: "var(--segment-part)",
    type: "text",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: Lightbulb,
    color: "var(--segment-beat)",
    type: "list",
  },
];

const PACING_SCHEMA: SectionConfig[] = [
  { key: "act_balance", label: "Act Balance", icon: BarChart3, color: "var(--color-ai)", type: "text" },
  {
    key: "tension_curve",
    label: "Tension Curve",
    icon: Activity,
    color: "var(--color-warning)",
    type: "text",
  },
  {
    key: "slow_spots",
    label: "Slow Spots",
    icon: AlertTriangle,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "pacing_strengths",
    label: "Strengths",
    icon: CheckCircle,
    color: "var(--color-success)",
    type: "list",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: Lightbulb,
    color: "var(--segment-beat)",
    type: "list",
  },
];

// ── Prose result renderer ─────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "issue") return <AlertCircle size={11} className={styles.iconIssue} />;
  if (severity === "warning") return <AlertTriangle size={11} className={styles.iconWarning} />;
  return <Info size={11} className={styles.iconInfo} />;
}

function ProseResultDisplay({ result }: { result: ProseNLPResponse }) {
  const scenes = result.scenes ?? [];
  const scenesWithFindings = scenes.filter(
    (s) =>
      (s.passive_voice?.findings?.length ?? 0) +
        (s.adverb_overuse?.findings?.length ?? 0) +
        (s.said_bookisms?.findings?.length ?? 0) +
        (s.repeated_words?.findings?.length ?? 0) >
      0,
  );

  if (scenes.length === 0) {
    return <p className={styles.empty}>No scenes analyzed.</p>;
  }

  return (
    <div className={styles.proseResults}>
      <p className={styles.proseSummary}>
        {scenesWithFindings.length} of {scenes.length} scene{scenes.length !== 1 ? "s" : ""} have findings
      </p>
      {scenes.map((scene) => {
        const findings = [
          ...(scene.passive_voice?.findings ?? []),
          ...(scene.adverb_overuse?.findings ?? []),
          ...(scene.said_bookisms?.findings ?? []),
          ...(scene.repeated_words?.findings ?? []),
        ];
        if (findings.length === 0 && !scene.sentence_variety) return null;
        return (
          <div key={scene.scene_id} className={styles.sceneBlock}>
            <div className={styles.sceneHeader}>
              <span className={styles.sceneTitle}>{scene.scene_title || "Untitled"}</span>
              {findings.length > 0 && (
                <span className={styles.sceneBadge}>
                  {findings.length} finding{findings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {scene.passive_voice && scene.passive_voice.passive_count > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>Passive Voice ({scene.passive_voice.percentage}%)</span>
                {scene.passive_voice.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            {scene.adverb_overuse && scene.adverb_overuse.adverb_count > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>Adverbs ({scene.adverb_overuse.adverb_count})</span>
                {scene.adverb_overuse.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            {scene.said_bookisms && scene.said_bookisms.bookism_count > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>Said-Bookisms ({scene.said_bookisms.bookism_count})</span>
                {scene.said_bookisms.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
            {scene.repeated_words && scene.repeated_words.findings.length > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>
                  Repeated Words ({scene.repeated_words.findings.length})
                </span>
                {scene.repeated_words.findings.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <SeverityIcon severity={f.severity} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  unclear: "var(--color-error, #ef4444)",
};

function EssentialQuestionsDisplay({ result }: { result: StructuredResult }) {
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

// ── Entity suggestions renderer ───────────────────────────────────────────────

function EntityResultDisplay({ result }: { result: EntitySuggestionsResponse }) {
  const chars = result.character_suggestions ?? [];
  const locs = result.location_suggestions ?? [];
  const total = chars.length + locs.length;
  if (total === 0) return <p className={styles.empty}>No unrecognized entities found.</p>;
  return (
    <div className={styles.entityResults}>
      {chars.length > 0 && (
        <div className={styles.entityGroup}>
          <div className={styles.entityGroupHeader}>
            <User size={12} />
            <span>Characters</span>
            <span className={styles.entityCount}>{chars.length}</span>
          </div>
          {chars.map((s) => (
            <div key={s.text} className={styles.entityRow}>
              <span className={styles.entityName}>{s.text}</span>
              <span className={styles.entityMeta}>
                {s.occurrences} occurrence{s.occurrences !== 1 ? "s" : ""} · {s.scene_count} scene
                {s.scene_count !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {locs.length > 0 && (
        <div className={styles.entityGroup}>
          <div className={styles.entityGroupHeader}>
            <MapPin size={12} />
            <span>Locations</span>
            <span className={styles.entityCount}>{locs.length}</span>
          </div>
          {locs.map((s) => (
            <div key={s.text} className={styles.entityRow}>
              <span className={styles.entityName}>{s.text}</span>
              <span className={styles.entityMeta}>
                {s.occurrences} occurrence{s.occurrences !== 1 ? "s" : ""} · {s.scene_count} scene
                {s.scene_count !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editorial consistency renderer ───────────────────────────────────────────

function EditorialResultDisplay({ result }: { result: EditorialConsistencyResponse }) {
  const scenes = result.scenes ?? [];
  const hasIssues = result.total_tense_shifts > 0 || result.total_pov_flags > 0;

  if (scenes.length === 0) return <p className={styles.empty}>No scenes analyzed.</p>;

  return (
    <div className={styles.proseResults}>
      <p className={styles.proseSummary}>
        {result.total_tense_shifts} tense shift{result.total_tense_shifts !== 1 ? "s" : ""} ·{" "}
        {result.total_pov_flags} POV flag{result.total_pov_flags !== 1 ? "s" : ""} across {scenes.length}{" "}
        scene{scenes.length !== 1 ? "s" : ""}
      </p>
      {!hasIssues && (
        <p className={styles.empty} style={{ fontStyle: "normal", color: "var(--color-success)" }}>
          No editorial issues found.
        </p>
      )}
      {scenes.map((scene) => {
        const tenseIssues = scene.tense_consistency?.findings ?? [];
        const povIssues = scene.pov_drift?.findings ?? [];
        if (tenseIssues.length === 0 && povIssues.length === 0) return null;
        return (
          <div key={scene.scene_id} className={styles.sceneBlock}>
            <div className={styles.sceneHeader}>
              <span className={styles.sceneTitle}>{scene.scene_title || "Untitled"}</span>
              <span className={styles.sceneBadge}>
                {tenseIssues.length + povIssues.length} flag
                {tenseIssues.length + povIssues.length !== 1 ? "s" : ""}
              </span>
            </div>
            {tenseIssues.length > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>
                  Tense Shifts ({tenseIssues.length}) — dominant: {scene.tense_consistency?.dominant_tense}
                </span>
                {tenseIssues.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <AlertTriangle size={11} className={styles.iconWarning} />
                    <span className={styles.findingText} title={f.sentence}>
                      {f.sentence.slice(0, 120)}
                      {f.sentence.length > 120 ? "…" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {povIssues.length > 0 && (
              <div className={styles.checkGroup}>
                <span className={styles.checkLabel}>POV Drift ({povIssues.length})</span>
                {povIssues.slice(0, 3).map((f, i) => (
                  <div key={i} className={styles.finding}>
                    <AlertTriangle size={11} className={styles.iconWarning} />
                    <span className={styles.findingText}>{f.explanation}</span>
                  </div>
                ))}
              </div>
            )}
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
  critical: "var(--color-error, #ef4444)",
  moderate: "var(--color-warning)",
  minor: "var(--color-text-muted)",
};

function ContinuityResultDisplay({ result }: { result: StructuredResult }) {
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

function ThemeResultDisplay({ result }: { result: StructuredResult }) {
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
          <span className={styles.checkLabel}>Thematic Gaps</span>
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

function PlotHolesResultDisplay({ result }: { result: StructuredResult }) {
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
          <span className={styles.checkLabel}>Logic Gaps</span>
          {data.logic_gaps.map((g, i) => (
            <p key={i} className={styles.note}>
              {g}
            </p>
          ))}
        </div>
      )}
      {data.unanswered_questions?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Unanswered Questions</span>
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

const FIRST_PASS_SCHEMA: SectionConfig[] = [
  {
    key: "goal_alignment",
    label: "Goal Alignment",
    icon: CheckCircle,
    color: "var(--color-success)",
    type: "text",
  },
  { key: "arc_progress", label: "Arc Progress", icon: TrendingUp, color: "var(--color-ai)", type: "text" },
  {
    key: "tone_consistency",
    label: "Tone Consistency",
    icon: Volume2,
    color: "var(--color-accent)",
    type: "text",
  },
  {
    key: "missed_setups",
    label: "Missed Setups",
    icon: AlertTriangle,
    color: "var(--color-warning)",
    type: "list",
  },
  { key: "strengths", label: "Strengths", icon: Star, color: "var(--color-success)", type: "list" },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: Lightbulb,
    color: "var(--segment-beat)",
    type: "list",
  },
];

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
      <span className={styles.checkLabel}>Intent Gaps ({gaps.length})</span>
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

function FirstPassResultDisplay({ result }: { result: StructuredResult }) {
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

// ── Cliche Analysis renderer ──────────────────────────────────────────────────

const SEVERITY_COLOR_CLICHE: Record<string, string> = {
  strong: "var(--color-error, #e05252)",
  moderate: "var(--color-warning, #d97706)",
  subtle: "var(--color-text-muted)",
};

function ClicheInstanceRow({ instance }: { instance: ClicheInstance }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY_COLOR_CLICHE[instance.severity] ?? "var(--color-text-muted)";
  return (
    <div className={styles.issueRow} style={{ alignItems: "flex-start" }}>
      <MinusCircle size={12} style={{ color, flexShrink: 0, marginTop: 3 }} />
      <div className={styles.issueBody}>
        <button
          className={styles.issueLabel}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
          }}
          onClick={() => setOpen((o) => !o)}
        >
          "{instance.passage}"
          <span
            style={{
              marginLeft: 6,
              fontSize: "0.68rem",
              color: "var(--color-text-muted)",
              fontStyle: "normal",
            }}
          >
            [{instance.cliche_type}] · {instance.severity} · {instance.scene_title}
          </span>
        </button>
        {open && (
          <>
            <p className={styles.issueSuggestion}>{instance.explanation}</p>
            {instance.intentional_use_case && (
              <p className={styles.issueMeta}>When it might work: {instance.intentional_use_case}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClicheResultDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as ClicheAnalysisResponse;
  return (
    <div>
      <div className={styles.summaryRow} style={{ marginBottom: "0.5rem" }}>
        <span className={`${styles.ratingBadge} ${styles[`rating_${data.overall_rating}`]}`}>
          {data.overall_rating?.replace("_", " ") ?? "—"}
        </span>
        <span className={styles.instanceCount}>
          {data.total_count === 0
            ? "No clichés found"
            : `${data.total_count} cliché${data.total_count !== 1 ? "s" : ""} found`}
        </span>
      </div>
      {data.summary && <p className={styles.summaryText}>{data.summary}</p>}
      {data.density_note && (
        <p className={styles.issueMeta} style={{ marginBottom: "0.5rem" }}>
          {data.density_note}
        </p>
      )}
      {data.categories.map(
        (cat, i) =>
          cat.instances.length > 0 && (
            <div key={i} className={styles.checkGroup}>
              <span className={styles.checkLabel}>
                {cat.name} ({cat.count})
              </span>
              {cat.instances.map((inst, j) => (
                <ClicheInstanceRow key={j} instance={inst} />
              ))}
            </div>
          ),
      )}
      {data.strengths.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel} style={{ color: "var(--color-success)" }}>
            Strengths
          </span>
          {data.strengths.map((s, i) => (
            <div key={i} className={styles.issueRow}>
              <CheckCircle size={12} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 2 }} />
              <span className={styles.issueBody}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Character Dimensionality ─────────────────────────────────────────────────

const DIMENSION_COLOR: Record<string, string> = {
  flat: "var(--color-text-muted)",
  developing: "var(--color-warning, #d97706)",
  dimensional: "var(--color-accent-secondary, #0d9488)",
  complex: "var(--color-ai)",
};

function CharacterDimensionRow({ char }: { char: CharacterDimensionEntry }) {
  const [open, setOpen] = useState(false);
  const color = DIMENSION_COLOR[char.dimension_score] ?? "var(--color-text-muted)";
  return (
    <div className={styles.checkGroup}>
      <button
        className={styles.checkLabel}
        style={{
          background: "none",
          border: "none",
          padding: "0.15rem 0",
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          width: "100%",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <span style={{ flex: 1 }}>{char.character_name}</span>
        <span style={{ fontSize: "0.68rem", color, fontWeight: 600, textTransform: "capitalize" }}>
          {char.dimension_score}
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
          {char.role}
        </span>
      </button>
      {open && (
        <div style={{ paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {char.strengths.length > 0 && (
            <div>
              <span className={styles.issueMeta} style={{ color: "var(--color-accent-secondary, #0d9488)" }}>
                Strengths
              </span>
              {char.strengths.map((s, i) => (
                <div key={i} className={styles.issueRow}>
                  <CheckCircle
                    size={11}
                    style={{ color: "var(--color-accent-secondary, #0d9488)", flexShrink: 0, marginTop: 2 }}
                  />
                  <span className={styles.issueBody}>{s}</span>
                </div>
              ))}
            </div>
          )}
          {char.gaps.length > 0 && (
            <div>
              <span className={styles.issueMeta} style={{ color: "var(--color-warning, #d97706)" }}>
                Gaps
              </span>
              {char.gaps.map((g, i) => (
                <div key={i} className={styles.issueRow}>
                  <AlertTriangle
                    size={11}
                    style={{ color: "var(--color-warning, #d97706)", flexShrink: 0, marginTop: 2 }}
                  />
                  <span className={styles.issueBody}>{g}</span>
                </div>
              ))}
            </div>
          )}
          {char.contradictions && (
            <p className={styles.issueSuggestion}>
              <strong>Contradictions:</strong> {char.contradictions}
            </p>
          )}
          {char.relationship_depth && (
            <p className={styles.issueMeta}>
              <strong>Relationships:</strong> {char.relationship_depth}
            </p>
          )}
          {char.recommendations.length > 0 && (
            <div>
              <span className={styles.issueMeta}>Recommendations</span>
              {char.recommendations.map((r, i) => (
                <div key={i} className={styles.issueRow}>
                  <Lightbulb size={11} style={{ color: "var(--color-ai)", flexShrink: 0, marginTop: 2 }} />
                  <span className={styles.issueBody}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterDimensionalityDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as CharacterDimensionalityResult;
  return (
    <div>
      <div className={styles.summaryRow} style={{ marginBottom: "0.5rem" }}>
        <span className={`${styles.ratingBadge} ${styles[`rating_${data.overall_rating}`]}`}>
          {data.overall_rating?.replace("_", " ") ?? "—"}
        </span>
        <span className={styles.instanceCount}>
          {data.characters.length} character{data.characters.length !== 1 ? "s" : ""}
        </span>
      </div>
      {data.summary && <p className={styles.summaryText}>{data.summary}</p>}
      {data.cast_balance && (
        <p className={styles.issueMeta} style={{ marginBottom: "0.5rem" }}>
          {data.cast_balance}
        </p>
      )}
      {(data.characters ?? []).map((char, i) => (
        <CharacterDimensionRow key={i} char={char} />
      ))}
      {data.ensemble_dynamics && (
        <div className={styles.checkGroup} style={{ marginTop: "0.35rem" }}>
          <span className={styles.checkLabel} style={{ color: "var(--color-ai)" }}>
            Ensemble Dynamics
          </span>
          <p className={styles.issueSuggestion}>{data.ensemble_dynamics}</p>
        </div>
      )}
    </div>
  );
}

// ── Voice Fidelity renderer ───────────────────────────────────────────────────

const FIDELITY_COLOR: Record<string, string> = {
  excellent: "var(--color-success, #22c55e)",
  good: "var(--color-nlp)",
  fair: "var(--color-warning, #d97706)",
  needs_work: "var(--color-error, #e05252)",
};

const SEVERITY_COLOR_FIDELITY: Record<string, string> = {
  issue: "var(--color-error, #e05252)",
  warning: "var(--color-warning, #d97706)",
  info: "var(--color-text-muted)",
};

const SEVERITY_ICON_FIDELITY: Record<string, React.ElementType> = {
  issue: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function VoiceFidelityDisplay({ result }: { result: StructuredResult }) {
  if (!result.success || !result.data)
    return <p className={styles.empty}>{result.raw_text || "No result."}</p>;
  const data = result.data as unknown as VoiceFidelityResult;
  const findings = (data.findings ?? []).filter((f: VoiceFidelityFinding) => f.severity !== "info");

  return (
    <div className={styles.aiResults}>
      <div className={styles.summaryRow} style={{ marginBottom: "0.5rem" }}>
        <span
          className={styles.ratingBadge}
          style={{
            background: `color-mix(in srgb, ${FIDELITY_COLOR[data.overall_fidelity] ?? "var(--color-text-muted)"} 15%, transparent)`,
            color: FIDELITY_COLOR[data.overall_fidelity] ?? "var(--color-text-muted)",
          }}
        >
          {data.overall_fidelity?.replace("_", " ") ?? "—"}
        </span>
        {data.character_name && <span className={styles.instanceCount}>{data.character_name}</span>}
      </div>
      {data.attribute_summary && (
        <p className={styles.issueMeta} style={{ marginBottom: "0.4rem" }}>
          {data.attribute_summary}
        </p>
      )}
      {data.summary && <p className={styles.aiSummary}>{data.summary}</p>}

      {findings.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Findings</span>
          {findings.map((f: VoiceFidelityFinding, i: number) => {
            const SevIcon = SEVERITY_ICON_FIDELITY[f.severity] ?? MinusCircle;
            const color = SEVERITY_COLOR_FIDELITY[f.severity] ?? "var(--color-text-muted)";
            return (
              <div key={i} className={styles.issueRow}>
                <SevIcon size={12} style={{ color, flexShrink: 0, marginTop: 2 }} />
                <div className={styles.issueBody}>
                  {f.dialogue_excerpt && (
                    <span className={styles.issueMeta} style={{ fontStyle: "italic" }}>
                      "{f.dialogue_excerpt.slice(0, 100)}
                      {f.dialogue_excerpt.length > 100 ? "…" : ""}"
                    </span>
                  )}
                  <span className={styles.issueLabel}>{f.explanation}</span>
                  {f.attribute_context && <span className={styles.issueMeta}>{f.attribute_context}</span>}
                  {f.suggestion && <p className={styles.issueSuggestion}>{f.suggestion}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.authentic_examples?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel} style={{ color: "var(--color-success)" }}>
            Lines that ring true
          </span>
          {data.authentic_examples.slice(0, 4).map((ex: string, i: number) => (
            <div key={i} className={styles.issueRow}>
              <CheckCircle size={12} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 2 }} />
              <span className={styles.issueBody} style={{ fontStyle: "italic" }}>
                "{ex.slice(0, 100)}
                {ex.length > 100 ? "…" : ""}"
              </span>
            </div>
          ))}
        </div>
      )}

      {data.recommendations?.length > 0 && (
        <div className={styles.checkGroup}>
          <span className={styles.checkLabel}>Recommendations</span>
          {data.recommendations.map((rec: string, i: number) => (
            <div key={i} className={styles.issueRow}>
              <Lightbulb size={12} style={{ color: "var(--color-ai)", flexShrink: 0, marginTop: 2 }} />
              <span className={styles.issueBody}>{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ReportCard ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const diffMs = Math.max(0, Date.now() - d.getTime());
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) {
    const mins = Math.round(diffMs / 60000);
    return mins <= 0 ? "just now" : `${mins}m ago`;
  }
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderBody(log: ActivityLog) {
  const feature = log.metadata_?.feature as string;
  const result = log.metadata_?.result;
  if (!result) return <p className={styles.empty}>No result data stored.</p>;

  switch (feature) {
    case "prose-analysis":
      return <ProseResultDisplay result={result as unknown as ProseNLPResponse} />;
    case "editorial-consistency":
      return <EditorialResultDisplay result={result as unknown as EditorialConsistencyResponse} />;
    case "economy-analysis":
      return (
        <StructuredResponseRenderer result={result as unknown as StructuredResult} schema={ECONOMY_SCHEMA} />
      );
    case "pacing-analysis":
      return (
        <StructuredResponseRenderer result={result as unknown as StructuredResult} schema={PACING_SCHEMA} />
      );
    case "essential-questions":
      return <EssentialQuestionsDisplay result={result as unknown as StructuredResult} />;
    case "entity-suggestions":
      return <EntityResultDisplay result={result as unknown as EntitySuggestionsResponse} />;
    case "continuity-check":
      return <ContinuityResultDisplay result={result as unknown as StructuredResult} />;
    case "theme-tracker":
      return <ThemeResultDisplay result={result as unknown as StructuredResult} />;
    case "plot-holes":
      return <PlotHolesResultDisplay result={result as unknown as StructuredResult} />;
    case "first-pass":
      return <FirstPassResultDisplay result={result as unknown as StructuredResult} />;
    case "cliche-analysis":
      return <ClicheResultDisplay result={result as unknown as StructuredResult} />;
    case "character-dimensionality":
      return <CharacterDimensionalityDisplay result={result as unknown as StructuredResult} />;
    case "voice-fidelity":
      return <VoiceFidelityDisplay result={result as unknown as StructuredResult} />;
    default:
      return <p className={styles.empty}>Unknown analysis type.</p>;
  }
}

interface Props {
  log: ActivityLog;
}

export default function ReportCard({ log }: Props) {
  const [expanded, setExpanded] = useState(false);
  const feature = (log.metadata_?.feature as string) ?? "";
  const meta = FEATURE_META[feature] ?? { label: feature, Icon: AlignLeft, color: "var(--color-text-muted)" };

  return (
    <div className={styles.card}>
      <button className={styles.header} onClick={() => setExpanded((e) => !e)}>
        <div className={styles.headerLeft}>
          {expanded ? (
            <ChevronDown size={13} className={styles.chevron} />
          ) : (
            <ChevronRight size={13} className={styles.chevron} />
          )}
          <meta.Icon size={13} className={styles.featureIcon} style={{ color: meta.color }} />
          <div className={styles.headerText}>
            <span className={styles.featureLabel}>{meta.label}</span>
            <span className={styles.description}>{log.description}</span>
          </div>
        </div>
        <span className={styles.timestamp}>{formatTimestamp(log.created_at)}</span>
      </button>
      {log.metadata_?.result != null && <AskAboutAnalysis log={log} label={meta.label} />}
      {expanded && <div className={styles.body}>{renderBody(log)}</div>}
    </div>
  );
}
