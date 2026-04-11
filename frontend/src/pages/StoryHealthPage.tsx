import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle2, Circle, AlertTriangle, TrendingUp, Users, GitBranch, Target, BookMarked, Activity, MessageSquare, Snowflake } from "lucide-react";
import { api } from "../api/client";
import type { StoryHealth, BeatSheet, PlotThread, DialogueStats, DialogueInteraction } from "../types";
import { useStoryStore } from "../stores/storyStore";
import WordCountProgress from "../components/health/WordCountProgress";
import MICEValidation from "../components/health/MICEValidation";
import StoryProgressionGraph from "../components/health/StoryProgressionGraph";
import ActionToolbar from "../components/health/ActionToolbar";
import ReportsView from "../components/health/ReportsView";
import styles from "./StoryHealthPage.module.css";

function WordBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.barValue}>{value.toLocaleString()}</span>
    </div>
  );
}

function flattenNodes(nodes: import("../types").StructureNode[]): import("../types").StructureNode[] {
  const out: import("../types").StructureNode[] = [];
  function walk(n: import("../types").StructureNode) { out.push(n); n.children.forEach(walk); }
  nodes.forEach(walk);
  return out;
}

export default function StoryHealthPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { activeStory, structure, characters } = useStoryStore();
  const [view, setView] = useState<"dashboard" | "reports">("dashboard");
  const [health, setHealth] = useState<StoryHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [beatSheet, setBeatSheet] = useState<BeatSheet | null>(null);
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [dialogueStats, setDialogueStats] = useState<DialogueStats | null>(null);
  const [dialogueInteractions, setDialogueInteractions] = useState<DialogueInteraction[]>([]);
  // Increment to trigger AnalysisSummaryCard refresh after toolbar runs
  const [analysisVersion, setAnalysisVersion] = useState(0);

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      const [h, t] = await Promise.all([
        api.getStoryHealth(storyId),
        api.listThreads(storyId),
      ]);
      setHealth(h);
      setThreads(t);
    } finally {
      setLoading(false);
    }
    api.getDialogueStats(storyId).then(setDialogueStats).catch(() => {});
    api.getDialogueInteractions(storyId).then(setDialogueInteractions).catch(() => {});
  }, [storyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeStory?.beat_sheet_id) { setBeatSheet(null); return; }
    api.listBeatSheets()
      .then(sheets => setBeatSheet(sheets.find(s => s.id === activeStory.beat_sheet_id) ?? null))
      .catch(() => {});
  }, [activeStory?.beat_sheet_id]);

  const handleAnalysisComplete = useCallback(() => {
    setAnalysisVersion((v) => v + 1);
  }, []);

  const assignedBeatIds = new Set(
    flattenNodes(structure).map(n => n.beat_id).filter(Boolean) as string[]
  );

  if (loading) return <div className={styles.loading}>Computing health…</div>;
  if (!health) return <div className={styles.loading}>Failed to load.</div>;

  const totalWords = health.word_count.total;
  const byStatus = health.word_count.by_status;
  const sceneTotal = health.scenes.total;
  const sceneByStatus = health.scenes.by_status;
  const avgWords = sceneTotal > 0 ? Math.round(totalWords / sceneTotal) : 0;

  const openThreads = health.threads.open.length;
  const developingThreads = health.threads.developing.length;
  const resolvedThreads = health.threads.resolved.length;
  const totalThreads = openThreads + developingThreads + resolvedThreads;

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Story Health</h2>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewTab} ${view === "dashboard" ? styles.viewTabActive : ""}`}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`${styles.viewTab} ${view === "reports" ? styles.viewTabActive : ""}`}
            onClick={() => setView("reports")}
          >
            Reports
          </button>
        </div>
        <button onClick={load} className={styles.refreshBtn} title="Refresh">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Analysis action toolbar */}
      {storyId && (
        <ActionToolbar storyId={storyId} onAnalysisComplete={handleAnalysisComplete} onViewReports={() => setView("reports")} />
      )}

      {view === "reports" ? (
        storyId ? <ReportsView storyId={storyId} key={analysisVersion} /> : null
      ) : (
        <div className={styles.grid}>

          {/* Word Count */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <TrendingUp size={14} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Word Count</h3>
            </div>
            <p className={styles.bigStat}>{totalWords.toLocaleString()}</p>
            <p className={styles.bigStatSub}>total · {avgWords.toLocaleString()} avg / scene</p>
            <div className={styles.barList}>
              <WordBar label="Draft" value={byStatus.draft ?? 0} max={totalWords} color="var(--color-text-muted)" />
              <WordBar label="Revised" value={byStatus.revised ?? 0} max={totalWords} color="var(--color-accent)" />
              <WordBar label="Final" value={byStatus.final ?? 0} max={totalWords} color="var(--color-success)" />
            </div>
            {health.word_count.target && (
              <WordCountProgress
                target={health.word_count.target}
                intendedLength={health.intended_length}
              />
            )}
          </section>

          {/* Scene Status */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <CheckCircle2 size={14} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Scenes</h3>
            </div>
            <p className={styles.bigStat}>{sceneTotal}</p>
            <p className={styles.bigStatSub}>total scenes</p>
            <div className={styles.statusPills}>
              <div className={styles.statusPill} style={{ background: "var(--color-surface-raised)" }}>
                <span className={styles.pillNum}>{sceneByStatus.draft ?? 0}</span>
                <span className={styles.pillLabel}>Draft</span>
              </div>
              <div className={styles.statusPill} style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}>
                <span className={styles.pillNum}>{sceneByStatus.revised ?? 0}</span>
                <span className={styles.pillLabel}>Revised</span>
              </div>
              <div className={styles.statusPill} style={{ background: "color-mix(in srgb, var(--color-success) 15%, transparent)" }}>
                <span className={styles.pillNum}>{sceneByStatus.final ?? 0}</span>
                <span className={styles.pillLabel}>Final</span>
              </div>
            </div>
          </section>

          {/* Story Goals */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <Target size={14} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Story Goals</h3>
            </div>
            {health.goals.total === 0 ? (
              <p className={styles.emptyNote}>No goals set — add them in the Lorebook.</p>
            ) : (
              <>
                <p className={styles.bigStat}>{health.goals.done}/{health.goals.total}</p>
                <p className={styles.bigStatSub}>goals completed</p>
                <div className={styles.goalList}>
                  {health.goals.items.map((g) => (
                    <div key={g.id} className={`${styles.goalItem} ${g.completed ? styles.goalDone : ""}`}>
                      {g.completed
                        ? <CheckCircle2 size={12} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                        : <Circle size={12} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                      }
                      <span>{g.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Plot Threads */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <GitBranch size={14} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Plot Threads</h3>
            </div>
            <p className={styles.bigStat}>{totalThreads}</p>
            <p className={styles.bigStatSub}>{openThreads} open · {developingThreads} developing · {resolvedThreads} resolved</p>
            <div className={styles.threadList}>
              {health.threads.open.map((t) => (
                <div key={t.id} className={styles.threadItem}>
                  <span className={`${styles.threadDot} ${styles.threadOpen}`} />
                  <span className={styles.threadName}>{t.name}</span>
                  <span className={styles.threadStatus}>open</span>
                </div>
              ))}
              {health.threads.developing.map((t) => (
                <div key={t.id} className={styles.threadItem}>
                  <span className={`${styles.threadDot} ${styles.threadDeveloping}`} />
                  <span className={styles.threadName}>{t.name}</span>
                  <span className={styles.threadStatus}>developing</span>
                </div>
              ))}
              {health.threads.resolved.map((t) => (
                <div key={t.id} className={`${styles.threadItem} ${styles.threadItemDone}`}>
                  <span className={`${styles.threadDot} ${styles.threadResolved}`} />
                  <span className={styles.threadName}>{t.name}</span>
                  <span className={styles.threadStatus}>resolved</span>
                </div>
              ))}
            </div>
            {totalThreads === 0 && (
              <p className={styles.emptyNote}>No threads yet — add them in Plot Threads.</p>
            )}
            {(() => {
              const thinResolved = health.threads.resolved.filter(
                (t) => t.mice_type && t.try_fail_cycle_count < 2
              );
              return thinResolved.length > 0 ? (
                <div className={styles.alertBanner}>
                  <AlertTriangle size={13} />
                  <span>
                    {thinResolved.map((t) => t.name).join(", ")}
                    {thinResolved.length === 1 ? " resolves" : " resolve"} with fewer than 2 try/fail cycles.
                    Consider adding more struggle before the resolution.
                  </span>
                </div>
              ) : null;
            })()}
            {health.mice_violations.length > 0 && (
              <div className={styles.miceViolationsWrap}>
                <MICEValidation violations={health.mice_violations} />
              </div>
            )}
          </section>

          {/* Beat Progress */}
          {beatSheet && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <BookMarked size={14} className={styles.cardIcon} />
                <h3 className={styles.cardTitle}>Beat Progress</h3>
              </div>
              <p className={styles.bigStatSub} style={{ marginBottom: "0.75rem" }}>
                {beatSheet.name} · {assignedBeatIds.size}/{beatSheet.beats.length} assigned
              </p>
              <div className={styles.beatTimeline}>
                <div className={styles.beatTrack} />
                {totalWords > 0 && health.word_count.target && (
                  <div
                    className={styles.beatCursor}
                    style={{ left: `${Math.min(100, (totalWords / health.word_count.target.max) * 100)}%` }}
                    title={`Current: ${totalWords.toLocaleString()} words`}
                  />
                )}
                {beatSheet.beats.map(beat => (
                  <div
                    key={beat.id}
                    className={`${styles.beatMarker} ${assignedBeatIds.has(beat.id) ? styles.beatDone : ""}`}
                    style={{ left: `${beat.position_pct}%` }}
                    title={`${beat.name} (${beat.position_pct}%)${assignedBeatIds.has(beat.id) ? " ✓" : ""}`}
                  />
                ))}
              </div>
              <div className={styles.beatList}>
                {beatSheet.beats.map(beat => {
                  const done = assignedBeatIds.has(beat.id);
                  return (
                    <div key={beat.id} className={`${styles.beatRow} ${done ? styles.beatRowDone : ""}`}>
                      {done
                        ? <CheckCircle2 size={12} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                        : <Circle size={12} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                      }
                      <span className={styles.beatPct}>{beat.position_pct}%</span>
                      <span className={styles.beatName}>{beat.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Character Arc Progress — col 3, spans rows 2–3 */}
          <section className={`${styles.card} ${styles.cardRightSpan}`}>
            <div className={styles.cardHeader}>
              <Users size={14} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Character Arcs & Screen Time</h3>
            </div>
            {health.absent_characters.length > 0 && (
              <div className={styles.alertBanner}>
                <AlertTriangle size={13} />
                <span>
                  {health.absent_characters.join(", ")} {health.absent_characters.length === 1 ? "hasn't" : "haven't"} appeared in recent scenes
                </span>
              </div>
            )}
            {health.characters.length === 0 ? (
              <p className={styles.emptyNote}>No characters yet.</p>
            ) : (
              <div className={styles.charGrid}>
                {health.characters.map((c) => (
                  <div key={c.id} className={styles.charCard}>
                    {/* Row 1: name + arc link */}
                    <div className={styles.charRow1}>
                      <button
                        className={styles.charName}
                        onClick={() => navigate(`/stories/${storyId}/characters/${c.id}`)}
                      >
                        {c.name}
                      </button>
                      <button
                        className={styles.viewArcBtn}
                        onClick={() => navigate(`/stories/${storyId}/characters/${c.id}?tab=arc`)}
                      >
                        Arc →
                      </button>
                    </div>
                    {/* Row 2: role */}
                    <div className={styles.charRow2}>
                      <span className={styles.charRole}>{c.role}</span>
                    </div>
                    {/* Row 3: scenes · [absent] · arc bar */}
                    <div className={styles.charRow3}>
                      <span className={styles.charStat}>{c.scene_appearances} scene{c.scene_appearances !== 1 ? "s" : ""}</span>
                      {c.recent_appearances === 0 && c.scene_appearances > 0 && (
                        <>
                          <span className={styles.charSep}>·</span>
                          <span className={styles.charAbsent}><AlertTriangle size={9} /> absent</span>
                        </>
                      )}
                      {c.arc_milestones_total > 0 && (
                        <>
                          <span className={styles.charSep}>·</span>
                          <div className={styles.charArcRow}>
                            <span className={styles.charArcLabel}>arc</span>
                            <div className={styles.charArcTrack}>
                              <div className={styles.charArcFill} style={{ width: `${c.arc_pct ?? 0}%` }} />
                            </div>
                            <span className={styles.charArcPct}>{c.arc_pct ?? 0}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Story Progression Graph — spans 2 cols, left side of row 3 */}
          {health.pacing.length > 0 && (
            <section className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardHeader}>
                <Activity size={14} className={styles.cardIcon} />
                <h3 className={styles.cardTitle}>Story Progression</h3>
              </div>
              <StoryProgressionGraph
                pacing={health.pacing}
                threads={threads}
                beatSheet={beatSheet}
                storyId={storyId!}
              />
            </section>
          )}

          {/* Snowflake Progress */}
          {activeStory && (activeStory.snowflake_sentence || activeStory.snowflake_paragraph || activeStory.snowflake_synopsis) && (() => {
            const storyLayers = [
              { label: "One-Sentence", done: activeStory.snowflake_sentence.trim().length > 0 },
              { label: "One-Paragraph", done: activeStory.snowflake_paragraph.trim().length > 0 },
              { label: "One-Page Synopsis", done: activeStory.snowflake_synopsis.trim().length > 0 },
            ];
            const charSummaryDone = characters.length > 0 && characters.every((c) => c.snowflake_summary.trim().length > 0);
            const charSynopsisDone = characters.length > 0 && characters.every((c) => c.snowflake_synopsis.trim().length > 0);
            const allLayers = [
              ...storyLayers,
              { label: `Character Summaries (${characters.filter((c) => c.snowflake_summary.trim().length > 0).length}/${characters.length})`, done: charSummaryDone },
              { label: `Character Synopses (${characters.filter((c) => c.snowflake_synopsis.trim().length > 0).length}/${characters.length})`, done: charSynopsisDone },
            ];
            const completedCount = allLayers.filter((l) => l.done).length;
            return (
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <Snowflake size={14} className={styles.cardIcon} />
                  <h3 className={styles.cardTitle}>Snowflake Progress</h3>
                </div>
                <p className={styles.bigStatSub} style={{ marginBottom: "0.75rem" }}>
                  {completedCount}/{allLayers.length} layers complete
                </p>
                <div className={styles.beatList}>
                  {allLayers.map((layer) => (
                    <div key={layer.label} className={styles.beatItem}>
                      <span className={layer.done ? styles.beatAssigned : styles.beatUnassigned}>
                        {layer.done ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                      </span>
                      <span className={styles.beatName}>{layer.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Dialogue Stats */}
          {dialogueStats && dialogueStats.total_blocks > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <MessageSquare size={14} className={styles.cardIcon} />
                <h3 className={styles.cardTitle}>Dialogue</h3>
                <span className={styles.cardMeta}>{dialogueStats.total_blocks} lines</span>
              </div>
              {dialogueStats.unattributed > 0 && (
                <div className={styles.alertBanner}>
                  <AlertTriangle size={13} />
                  <span>{dialogueStats.unattributed} unattributed dialogue line{dialogueStats.unattributed !== 1 ? "s" : ""} — consider adding <code>@Name: "..."</code> attribution</span>
                </div>
              )}
              <div className={styles.dialogueBars}>
                {dialogueStats.by_character.slice(0, 8).map((c) => {
                  const maxWords = dialogueStats.by_character[0]?.word_count ?? 1;
                  const pct = Math.round((c.word_count / maxWords) * 100);
                  return (
                    <div key={c.speaker_name} className={styles.barRow}>
                      <span className={styles.barLabel}>{c.speaker_name}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%`, background: "var(--color-accent)" }} />
                      </div>
                      <span className={styles.barValue}>{c.word_count.toLocaleString()} w · {c.line_count} lines</span>
                    </div>
                  );
                })}
              </div>
              {dialogueInteractions.length > 0 && (
                <div className={styles.interactionsWrap}>
                  <p className={styles.interactionsLabel}>Top interactions</p>
                  <div className={styles.interactionsList}>
                    {dialogueInteractions.slice(0, 6).map((pair) => (
                      <div key={`${pair.character_a_id}-${pair.character_b_id}`} className={styles.interactionPair}>
                        <span className={styles.interactionNames}>{pair.character_a_name} ↔ {pair.character_b_name}</span>
                        <span className={styles.interactionCount}>{pair.scene_count} scene{pair.scene_count !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

        </div>
      )}
    </div>
  );
}
