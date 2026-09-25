import { parseServerDate } from "../../lib/serverDate";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  ListOrdered,
  GitCompare,
  Mic,
  StickyNote,
  AlertTriangle,
  Trash2,
  ArrowUpCircle,
  MinusCircle,
  ArrowDownCircle,
} from "lucide-react";
import type { ActivityLog } from "../../types";
import styles from "./EditorialReportCard.module.css";

interface Props {
  log: ActivityLog;
  onDelete: (id: string) => void;
}

type Section = "fresh-eyes" | "priorities" | "intent-gaps" | "voice" | "marginal";

const SECTIONS: { key: Section; label: string; Icon: React.ElementType; countKey: string }[] = [
  { key: "fresh-eyes", label: "Fresh Eyes", Icon: Eye, countKey: "fresh_eyes_count" },
  { key: "priorities", label: "Priorities", Icon: ListOrdered, countKey: "priorities_count" },
  { key: "intent-gaps", label: "Intent vs Execution", Icon: GitCompare, countKey: "intent_gaps_count" },
  { key: "voice", label: "Voice", Icon: Mic, countKey: "voice_notes_count" },
  { key: "marginal", label: "Marginal Notes", Icon: StickyNote, countKey: "marginal_notes_count" },
];

function ImpactBadge({ impact }: { impact: string }) {
  if (impact === "high")
    return (
      <span className={`${styles.badge} ${styles.badgeHigh}`}>
        <ArrowUpCircle size={10} />
        High
      </span>
    );
  if (impact === "low")
    return (
      <span className={`${styles.badge} ${styles.badgeLow}`}>
        <ArrowDownCircle size={10} />
        Low
      </span>
    );
  return (
    <span className={`${styles.badge} ${styles.badgeMed}`}>
      <MinusCircle size={10} />
      Medium
    </span>
  );
}

function NoteTypeBadge({ type }: { type: string }) {
  if (type === "strength")
    return <span className={`${styles.typeBadge} ${styles.typeStrength}`}>Strength</span>;
  if (type === "concern") return <span className={`${styles.typeBadge} ${styles.typeConcern}`}>Concern</span>;
  return <span className={`${styles.typeBadge} ${styles.typeSuggestion}`}>Suggestion</span>;
}

function FreshEyesSection({ data }: { data: { questions: unknown[]; summary: string } }) {
  if (!data.questions?.length && !data.summary)
    return <p className={styles.empty}>No fresh eyes questions generated.</p>;
  return (
    <div className={styles.sectionBody}>
      {data.summary && <p className={styles.summary}>{data.summary}</p>}
      {(
        data.questions as Array<{ section_title: string; question: string; context: string; anchor: string }>
      ).map((q, i) => (
        <div key={i} className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.sectionTag}>{q.section_title}</span>
          </div>
          <p className={styles.itemText}>{q.question}</p>
          {q.anchor && <blockquote className={styles.anchor}>"{q.anchor}"</blockquote>}
          {q.context && <p className={styles.context}>{q.context}</p>}
        </div>
      ))}
    </div>
  );
}

function PrioritiesSection({ data }: { data: { priorities: unknown[]; overall_note: string } }) {
  if (!data.priorities?.length) return <p className={styles.empty}>No priorities generated.</p>;
  return (
    <div className={styles.sectionBody}>
      {data.overall_note && <p className={styles.summary}>{data.overall_note}</p>}
      {(
        data.priorities as Array<{
          rank: number;
          section_title: string;
          issue: string;
          suggestion: string;
          impact: string;
          anchor: string;
        }>
      ).map((p, i) => (
        <div key={i} className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.rankBadge}>#{p.rank}</span>
            <span className={styles.sectionTag}>{p.section_title}</span>
            <ImpactBadge impact={p.impact} />
          </div>
          <p className={styles.itemIssue}>{p.issue}</p>
          <p className={styles.itemText}>{p.suggestion}</p>
          {p.anchor && <blockquote className={styles.anchor}>"{p.anchor}"</blockquote>}
        </div>
      ))}
    </div>
  );
}

function IntentGapsSection({
  data,
}: {
  data: { gaps: unknown[]; sections_aligned: string[]; summary: string };
}) {
  if (!data.gaps?.length && !data.summary)
    return (
      <p className={styles.empty}>No intent gaps found — strong alignment between plan and execution.</p>
    );
  return (
    <div className={styles.sectionBody}>
      {data.summary && <p className={styles.summary}>{data.summary}</p>}
      {data.sections_aligned?.length > 0 && (
        <div className={styles.aligned}>
          <span className={styles.alignedLabel}>Well-aligned:</span>
          {data.sections_aligned.map((s, i) => (
            <span key={i} className={styles.alignedTag}>
              {s}
            </span>
          ))}
        </div>
      )}
      {(
        data.gaps as Array<{
          section_title: string;
          stated_intent: string;
          execution: string;
          gap: string;
          suggestion: string;
          anchor: string;
        }>
      ).map((g, i) => (
        <div key={i} className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.sectionTag}>{g.section_title}</span>
          </div>
          <div className={styles.intentRow}>
            <span className={styles.intentLabel}>Intended:</span>
            <span className={styles.intentText}>{g.stated_intent}</span>
          </div>
          <div className={styles.intentRow}>
            <span className={styles.intentLabel}>Executed:</span>
            <span className={styles.intentText}>{g.execution}</span>
          </div>
          <p className={styles.itemIssue}>{g.gap}</p>
          <p className={styles.itemText}>{g.suggestion}</p>
          {g.anchor && <blockquote className={styles.anchor}>"{g.anchor}"</blockquote>}
        </div>
      ))}
    </div>
  );
}

function VoiceSection({
  data,
}: {
  data: { overall_voice: string; sections: unknown[]; consistency_rating: string; summary: string };
}) {
  const ratingClass =
    data.consistency_rating === "consistent"
      ? styles.ratingGood
      : data.consistency_rating === "minor-drift"
        ? styles.ratingWarn
        : styles.ratingBad;
  return (
    <div className={styles.sectionBody}>
      {data.overall_voice && (
        <div className={styles.voiceBox}>
          <span className={styles.voiceLabel}>Overall voice</span>
          <p className={styles.voiceText}>{data.overall_voice}</p>
        </div>
      )}
      {data.consistency_rating && (
        <div className={`${styles.ratingPill} ${ratingClass}`}>
          {data.consistency_rating.replace("-", " ")}
        </div>
      )}
      {data.summary && <p className={styles.summary}>{data.summary}</p>}
      {(
        data.sections as Array<{
          section_title: string;
          observation: string;
          anchor: string;
          deviation: boolean;
        }>
      )
        .filter((s) => s.deviation)
        .map((s, i) => (
          <div key={i} className={`${styles.item} ${styles.itemDeviation}`}>
            <div className={styles.itemHeader}>
              <span className={styles.sectionTag}>{s.section_title}</span>
              <span className={styles.driftTag}>Voice drift</span>
            </div>
            <p className={styles.itemText}>{s.observation}</p>
            {s.anchor && <blockquote className={styles.anchor}>"{s.anchor}"</blockquote>}
          </div>
        ))}
    </div>
  );
}

function MarginalSection({ data }: { data: { notes: unknown[] } }) {
  if (!data.notes?.length) return <p className={styles.empty}>No marginal notes generated.</p>;
  return (
    <div className={styles.sectionBody}>
      {(data.notes as Array<{ section_title: string; anchor: string; comment: string; type: string }>).map(
        (n, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.sectionTag}>{n.section_title}</span>
              <NoteTypeBadge type={n.type} />
            </div>
            {n.anchor && <blockquote className={styles.anchor}>"{n.anchor}"</blockquote>}
            <p className={styles.itemText}>{n.comment}</p>
          </div>
        ),
      )}
    </div>
  );
}

export function EditorialReportCard({ log, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta = log.metadata_ as Record<string, unknown> | undefined;
  if (!meta) return null;

  const stats = meta.stats as Record<string, number> | undefined;
  const contextLevel = meta.context_level as string;
  const scopeType = meta.scope_type as string;
  const scopeIds = meta.scope_ids as string[] | undefined;
  const error = meta.error as string | undefined;

  const scopeLabel =
    scopeType === "story"
      ? "Whole Story"
      : scopeType === "chapters"
        ? `${scopeIds?.length ?? 0} chapter(s)`
        : `${scopeIds?.length ?? 0} scene(s)`;

  const contextLabel =
    contextLevel === "full"
      ? "Full Manuscript"
      : contextLevel === "summaries"
        ? "With Summaries"
        : "Section Only";

  const timestamp = parseServerDate(log.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  function toggleSection(key: Section) {
    setActiveSection((s) => (s === key ? null : key));
  }

  return (
    <div className={styles.card}>
      {/* Header */}
      <button className={styles.header} onClick={() => setExpanded((s) => !s)}>
        <div className={styles.headerLeft}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <div className={styles.headerInfo}>
            <span className={styles.timestamp}>{timestamp}</span>
            <span className={styles.meta}>
              <span className={styles.metaChip}>{contextLabel}</span>
              <span className={styles.metaSep}>·</span>
              <span className={styles.metaChip}>{scopeLabel}</span>
            </span>
          </div>
        </div>
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          title="Delete report"
        >
          <Trash2 size={13} />
        </button>
      </button>

      {confirmDelete && (
        <div className={styles.confirmDelete}>
          <p>Delete this report? Editorial notes from this run will also be removed.</p>
          <div className={styles.confirmActions}>
            <button
              className={styles.confirmYes}
              onClick={() => {
                onDelete(log.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </button>
            <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className={styles.body}>
          {error && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={13} />
              <span>Some analyses had errors: {error}</span>
            </div>
          )}

          {/* Section tabs */}
          {SECTIONS.map(({ key, label, Icon, countKey }) => {
            const count = stats?.[countKey] ?? 0;
            const isActive = activeSection === key;
            return (
              <div key={key} className={styles.section}>
                <button
                  className={`${styles.sectionToggle} ${isActive ? styles.sectionToggleActive : ""}`}
                  onClick={() => toggleSection(key)}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                  <span className={styles.count}>{count}</span>
                  {isActive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {isActive && (
                  <div className={styles.sectionContent}>
                    {key === "fresh-eyes" && (
                      <FreshEyesSection data={meta.fresh_eyes as { questions: unknown[]; summary: string }} />
                    )}
                    {key === "priorities" && (
                      <PrioritiesSection
                        data={meta.priorities as { priorities: unknown[]; overall_note: string }}
                      />
                    )}
                    {key === "intent-gaps" && (
                      <IntentGapsSection
                        data={
                          meta.intent_gaps as { gaps: unknown[]; sections_aligned: string[]; summary: string }
                        }
                      />
                    )}
                    {key === "voice" && (
                      <VoiceSection
                        data={
                          meta.voice as {
                            overall_voice: string;
                            sections: unknown[];
                            consistency_rating: string;
                            summary: string;
                          }
                        }
                      />
                    )}
                    {key === "marginal" && (
                      <MarginalSection data={meta.marginal_notes as { notes: unknown[] }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
