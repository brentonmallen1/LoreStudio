import { useState } from "react";
import {
  AlignLeft, Compass, HelpCircle, Search,
  ChevronDown, ChevronRight,
  AlertCircle, AlertTriangle, Info,
  User, MapPin, BarChart3, Activity, RefreshCw, Lightbulb,
} from "lucide-react";
import type {
  ActivityLog, ProseNLPResponse, EntitySuggestionsResponse, StructuredResult,
} from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import styles from "./ReportCard.module.css";

// ── Feature metadata ──────────────────────────────────────────────────────────

const FEATURE_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  "prose-analysis": { label: "Prose Analysis", Icon: AlignLeft, color: "var(--color-nlp)" },
  "economy-analysis": { label: "Economy Analysis", Icon: Compass, color: "var(--color-accent)" },
  "essential-questions": { label: "Story Compass", Icon: HelpCircle, color: "var(--color-accent)" },
  "entity-suggestions": { label: "Lorebook Entities", Icon: Search, color: "var(--color-nlp)" },
};

// ── Economy schema (mirrors EconomyAnalysisPanel) ─────────────────────────────

const ECONOMY_SCHEMA: SectionConfig[] = [
  { key: "thread_balance", label: "Thread Balance", icon: BarChart3, color: "var(--color-accent)", type: "text" },
  { key: "scene_economy", label: "Scene Economy", icon: Activity, color: "var(--color-warning)", type: "text" },
  { key: "try_fail_cycles", label: "Try/Fail Cycles", icon: RefreshCw, color: "var(--segment-part)", type: "text" },
  { key: "recommendations", label: "Recommendations", icon: Lightbulb, color: "var(--segment-beat)", type: "list" },
];

// ── Prose result renderer ─────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "issue") return <AlertCircle size={11} className={styles.iconIssue} />;
  if (severity === "warning") return <AlertTriangle size={11} className={styles.iconWarning} />;
  return <Info size={11} className={styles.iconInfo} />;
}

function ProseResultDisplay({ result }: { result: ProseNLPResponse }) {
  const scenes = result.scenes ?? [];
  const scenesWithFindings = scenes.filter((s) =>
    (s.passive_voice?.findings?.length ?? 0) +
    (s.adverb_overuse?.findings?.length ?? 0) +
    (s.said_bookisms?.findings?.length ?? 0) +
    (s.repeated_words?.findings?.length ?? 0) > 0
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
                <span className={styles.sceneBadge}>{findings.length} finding{findings.length !== 1 ? "s" : ""}</span>
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
                <span className={styles.checkLabel}>Repeated Words ({scene.repeated_words.findings.length})</span>
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
            {q.recommendation && q.status !== "clear" && (
              <p className={styles.eqRec}>{q.recommendation}</p>
            )}
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
                {s.occurrences} occurrence{s.occurrences !== 1 ? "s" : ""} · {s.scene_count} scene{s.scene_count !== 1 ? "s" : ""}
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
                {s.occurrences} occurrence{s.occurrences !== 1 ? "s" : ""} · {s.scene_count} scene{s.scene_count !== 1 ? "s" : ""}
              </span>
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
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return `${Math.round(diffMs / 60000)}m ago`;
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
    case "economy-analysis":
      return <StructuredResponseRenderer result={result as unknown as StructuredResult} schema={ECONOMY_SCHEMA} />;
    case "essential-questions":
      return <EssentialQuestionsDisplay result={result as unknown as StructuredResult} />;
    case "entity-suggestions":
      return <EntityResultDisplay result={result as unknown as EntitySuggestionsResponse} />;
    default:
      return <p className={styles.empty}>Unknown analysis type.</p>;
  }
}

interface Props {
  log: ActivityLog;
}

export default function ReportCard({ log }: Props) {
  const [expanded, setExpanded] = useState(false);
  const feature = log.metadata_?.feature as string ?? "";
  const meta = FEATURE_META[feature] ?? { label: feature, Icon: AlignLeft, color: "var(--color-text-muted)" };

  return (
    <div className={styles.card}>
      <button className={styles.header} onClick={() => setExpanded((e) => !e)}>
        <div className={styles.headerLeft}>
          {expanded ? <ChevronDown size={13} className={styles.chevron} /> : <ChevronRight size={13} className={styles.chevron} />}
          <meta.Icon size={13} className={styles.featureIcon} style={{ color: meta.color }} />
          <div className={styles.headerText}>
            <span className={styles.featureLabel}>{meta.label}</span>
            <span className={styles.description}>{log.description}</span>
          </div>
        </div>
        <span className={styles.timestamp}>{formatTimestamp(log.created_at)}</span>
      </button>
      {expanded && <div className={styles.body}>{renderBody(log)}</div>}
    </div>
  );
}
