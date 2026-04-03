import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle2, Circle, AlertTriangle, TrendingUp, Users, GitBranch, Target } from "lucide-react";
import { api } from "../api/client";
import type { StoryHealth } from "../types";
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

function ArcRing({ pct, name }: { pct: number | null; name: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = pct != null ? (pct / 100) * circ : 0;
  return (
    <div className={styles.arcRing} title={`${name}: ${pct != null ? pct + "%" : "no milestones"}`}>
      <svg width={52} height={52} viewBox="0 0 52 52">
        <circle cx={26} cy={26} r={r} fill="none" stroke="var(--color-border)" strokeWidth={4} />
        <circle
          cx={26} cy={26} r={r}
          fill="none"
          stroke={pct != null ? "var(--color-accent)" : "var(--color-border)"}
          strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
        <text x={26} y={30} textAnchor="middle" fontSize={10} fill="var(--color-text)" fontWeight={600}>
          {pct != null ? `${pct}%` : "—"}
        </text>
      </svg>
      <span className={styles.arcName}>{name.split(" ")[0]}</span>
    </div>
  );
}

export default function StoryHealthPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [health, setHealth] = useState<StoryHealth | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!storyId) return;
    setLoading(true);
    try {
      const h = await api.getStoryHealth(storyId);
      setHealth(h);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [storyId]);

  if (loading) return <div className={styles.loading}>Computing health…</div>;
  if (!health) return <div className={styles.loading}>Failed to load.</div>;

  const totalWords = health.word_count.total;
  const byStatus = health.word_count.by_status;
  const sceneTotal = health.scenes.total;
  const sceneByStatus = health.scenes.by_status;

  const maxPacingWords = Math.max(...health.pacing.map((p) => p.word_count), 1);
  const avgWords = sceneTotal > 0 ? Math.round(totalWords / sceneTotal) : 0;

  const openThreads = health.threads.open.length;
  const developingThreads = health.threads.developing.length;
  const resolvedThreads = health.threads.resolved.length;
  const totalThreads = openThreads + developingThreads + resolvedThreads;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Story Health</h2>
        <button onClick={load} className={styles.refreshBtn} title="Refresh">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

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
            <WordBar label="Final" value={byStatus.final ?? 0} max={totalWords} color="#4caf82" />
          </div>
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
            <div className={styles.statusPill} style={{ background: "color-mix(in srgb, #4caf82 15%, transparent)" }}>
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
                      ? <CheckCircle2 size={12} style={{ color: "#4caf82", flexShrink: 0 }} />
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
        </section>

        {/* Character Arc Progress */}
        <section className={`${styles.card} ${styles.cardWide}`}>
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
                  <div className={styles.charTopRow}>
                    <button
                      className={styles.charName}
                      onClick={() => navigate(`/stories/${storyId}/characters/${c.id}`)}
                    >
                      {c.name}
                    </button>
                    <span className={styles.charRole}>{c.role}</span>
                  </div>
                  <div className={styles.charStats}>
                    <span className={styles.charStat} title="Total scene appearances">
                      {c.scene_appearances} scene{c.scene_appearances !== 1 ? "s" : ""}
                    </span>
                    {c.recent_appearances === 0 && c.scene_appearances > 0 && (
                      <span className={styles.charAbsent} title="Not in recent scenes">
                        <AlertTriangle size={10} /> absent
                      </span>
                    )}
                  </div>
                  {c.arc_milestones_total > 0 && (
                    <div className={styles.charArcRow}>
                      <div className={styles.charArcTrack}>
                        <div
                          className={styles.charArcFill}
                          style={{ width: `${c.arc_pct ?? 0}%` }}
                        />
                      </div>
                      <span className={styles.charArcPct}>{c.arc_pct ?? 0}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pacing Heatmap */}
        {health.pacing.length > 0 && (
          <section className={`${styles.card} ${styles.cardFull}`}>
            <div className={styles.cardHeader}>
              <TrendingUp size={14} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Pacing — Words per Scene</h3>
            </div>
            <div className={styles.heatmap}>
              {health.pacing.map((entry) => {
                const intensity = maxPacingWords > 0 ? entry.word_count / maxPacingWords : 0;
                const statusColor =
                  entry.status === "final" ? "#4caf82" :
                  entry.status === "revised" ? "var(--color-accent)" :
                  "var(--color-text-muted)";
                return (
                  <div
                    key={entry.id}
                    className={styles.heatCell}
                    title={`${entry.title}: ${entry.word_count.toLocaleString()} words (${entry.status})`}
                    style={{
                      opacity: entry.word_count === 0 ? 0.2 : 0.3 + intensity * 0.7,
                      background: statusColor,
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.heatLegend}>
              <span className={styles.heatLegendItem}><span style={{ background: "var(--color-text-muted)", opacity: 0.6 }} className={styles.heatSwatch} /> Draft</span>
              <span className={styles.heatLegendItem}><span style={{ background: "var(--color-accent)", opacity: 0.8 }} className={styles.heatSwatch} /> Revised</span>
              <span className={styles.heatLegendItem}><span style={{ background: "#4caf82", opacity: 0.8 }} className={styles.heatSwatch} /> Final</span>
              <span className={styles.heatLegendItem} style={{ marginLeft: "auto" }}>Darker = more words</span>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
