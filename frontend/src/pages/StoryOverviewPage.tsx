import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PenLine, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { useStoryStore } from "../stores/storyStore";
import type { StoryOverview } from "../types";
import styles from "./StoryOverviewPage.module.css";

const LENGTH_LABELS: Record<string, string> = {
  flash_fiction: "Flash Fiction",
  short_story: "Short Story",
  novelette: "Novelette",
  novella: "Novella",
  novel: "Novel",
  epic_saga: "Epic / Saga",
  series: "Series",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ProgressRing({
  pct,
  size = 90,
  stroke = 7,
  warning,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  warning: "normal" | "approaching" | "exceeded";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const color =
    warning === "exceeded" ? "#e05050" :
    warning === "approaching" ? "#f0a050" :
    "var(--color-accent)";

  return (
    <svg width={size} height={size} className={styles.ring}>
      <circle className={styles.ringBg} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
      <circle
        className={styles.ringFill}
        cx={size / 2} cy={size / 2} r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ stroke: color }}
      />
    </svg>
  );
}

export default function StoryOverviewPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { activeStory, structure, setActiveNode } = useStoryStore();
  const [overview, setOverview] = useState<StoryOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Recap state
  const [recapText, setRecapText] = useState("");
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapDone, setRecapDone] = useState(false);
  const recapAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!storyId) return;
    api.getStoryOverview(storyId)
      .then(setOverview)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  async function fetchRecap() {
    if (!storyId) return;
    recapAbort.current?.abort();
    const ctrl = new AbortController();
    recapAbort.current = ctrl;
    setRecapText("");
    setRecapDone(false);
    setRecapLoading(true);

    try {
      const res = await api.recapLastSession(storyId, ctrl.signal);
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setRecapText((t) => t + decoder.decode(value));
      }
      setRecapDone(true);
    } catch {
      // silently ignore abort
    } finally {
      setRecapLoading(false);
    }
  }

  if (!activeStory) return <div className={styles.loading}>Loading…</div>;

  const story = activeStory;
  const ov = overview;

  function findNode(id: string) {
    const queue = [...structure];
    while (queue.length) {
      const n = queue.shift()!;
      if (n.id === id) return n;
      if (n.children) queue.push(...n.children);
    }
    return null;
  }

  function continueWriting() {
    if (!storyId) return;
    if (ov?.recent_scenes?.[0]) {
      const node = findNode(ov.recent_scenes[0].id);
      if (node) { setActiveNode(node); }
    }
    navigate(`/stories/${storyId}/write`);
  }

  function openScene(sceneId: string) {
    const node = findNode(sceneId);
    if (node) setActiveNode(node);
    navigate(`/stories/${storyId}/write`);
  }

  const wordCount = ov?.word_count ?? 0;
  const wordTarget = ov?.word_count_target;
  const targetPct = wordTarget?.pct ?? 0;
  const targetWarning = wordTarget?.warning_level ?? "normal";
  const hasContent = (ov?.scene_count ?? 0) > 0 || wordCount > 0;
  const recentScene = ov?.recent_scenes?.[0];

  const lastSessionText = recentScene
    ? `Last worked on "${recentScene.title}" ${timeAgo(recentScene.updated_at)}`
    : hasContent
    ? `Last updated ${timeAgo(story.updated_at)}`
    : null;

  // Count non-leaf nodes as structural containers (acts/chapters)
  const totalNodes = structure.reduce(function count(sum: number, n): number {
    return sum + 1 + (n.children?.reduce(count, 0) ?? 0);
  }, 0);
  const containerCount = totalNodes - (ov?.scene_count ?? 0);

  return (
    <div className={styles.page}>
      <div className={styles.content}>

        {/* ── Title + identity ── */}
        <div className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>{story.title}</h1>
            {story.logline ? (
              <p className={styles.logline}>{story.logline}</p>
            ) : story.premise ? (
              <p className={styles.logline}>{story.premise}</p>
            ) : story.narrative_intent ? (
              <p className={styles.logline}><em>{story.narrative_intent}</em></p>
            ) : null}
            <div className={styles.meta}>
              {story.genre && <span className={styles.metaItem}>{story.genre}</span>}
              {story.tone && <span className={styles.metaItem}>{story.tone}</span>}
              {story.intended_length && (
                <span className={`${styles.metaItem} ${styles.metaAccent}`}>
                  {LENGTH_LABELS[story.intended_length] ?? story.intended_length}
                </span>
              )}
            </div>
          </div>

          {wordTarget && hasContent && (
            <div className={styles.progressWrap}>
              <ProgressRing pct={targetPct} size={88} stroke={7} warning={targetWarning} />
              <div className={styles.progressInner}>
                <span className={styles.progressPct}>{Math.round(targetPct)}%</span>
              </div>
              <p className={styles.progressLabel}>
                {wordCount.toLocaleString()} / {(wordTarget.max ?? 0).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* ── Metrics row ── */}
        {ov && (
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{wordCount.toLocaleString()}</span>
              <span className={styles.metricLabel}>words</span>
              {wordTarget && (
                <div className={styles.metricBar}>
                  <div
                    className={styles.metricBarFill}
                    style={{
                      width: `${Math.min(targetPct, 100)}%`,
                      background:
                        targetWarning === "exceeded" ? "#e05050" :
                        targetWarning === "approaching" ? "#f0a050" :
                        "var(--color-accent)",
                    }}
                  />
                </div>
              )}
            </div>
            <div className={styles.metricDivider} />
            <div className={styles.metric}>
              <span className={styles.metricValue}>{ov.scene_count}</span>
              <span className={styles.metricLabel}>
                {ov.scene_count === 1 ? "scene" : "scenes"}
              </span>
              <div className={styles.metricSubrow}>
                <span className={styles.metricSub} style={{ color: "var(--color-text-muted)" }}>
                  {ov.scenes_by_status.draft ?? 0} draft
                </span>
                <span className={styles.metricSub} style={{ color: "var(--color-accent)" }}>
                  {ov.scenes_by_status.revised ?? 0} revised
                </span>
                <span className={styles.metricSub} style={{ color: "#4caf82" }}>
                  {ov.scenes_by_status.final ?? 0} final
                </span>
              </div>
            </div>
            {containerCount > 0 && (
              <>
                <div className={styles.metricDivider} />
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{containerCount}</span>
                  <span className={styles.metricLabel}>
                    {containerCount === 1 ? "chapter" : "chapters"}
                  </span>
                </div>
              </>
            )}
            <div className={styles.metricDivider} />
            <div className={styles.metric}>
              <span className={styles.metricValue}>{ov.character_count}</span>
              <span className={styles.metricLabel}>
                {ov.character_count === 1 ? "character" : "characters"}
              </span>
            </div>
            {((ov.thread_counts.open ?? 0) + (ov.thread_counts.developing ?? 0) + (ov.thread_counts.resolved ?? 0)) > 0 && (
              <>
                <div className={styles.metricDivider} />
                <div className={styles.metric}>
                  <span className={styles.metricValue}>
                    {(ov.thread_counts.open ?? 0) + (ov.thread_counts.developing ?? 0) + (ov.thread_counts.resolved ?? 0)}
                  </span>
                  <span className={styles.metricLabel}>plot threads</span>
                  <div className={styles.metricSubrow}>
                    <span className={styles.metricSub}>{ov.thread_counts.open ?? 0} open</span>
                    <span className={styles.metricSub}>{ov.thread_counts.resolved ?? 0} resolved</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Word count distribution ── */}
        {ov && ov.distribution.length > 1 && wordCount > 0 && (
          <div className={styles.distSection}>
            <h2 className={styles.sectionTitle}>Word count by chapter</h2>
            <div className={styles.distBars}>
              {ov.distribution.map((entry) => (
                <div key={entry.id} className={styles.distRow}>
                  <span className={styles.distLabel} title={entry.title}>
                    {entry.title}
                  </span>
                  <div className={styles.distTrack}>
                    <div
                      className={styles.distFill}
                      style={{ width: `${entry.pct}%` }}
                    />
                  </div>
                  <span className={styles.distCount}>
                    {entry.word_count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Continue writing CTA ── */}
        <div className={styles.ctaSection}>
          <button className={styles.continueBtn} onClick={continueWriting}>
            <PenLine size={17} />
            <span className={styles.continueBtnText}>
              {hasContent ? "Continue Writing" : "Start Writing"}
            </span>
            <ArrowRight size={15} className={styles.continueBtnArrow} />
          </button>
          {lastSessionText && (
            <p className={styles.lastSession}>{lastSessionText}</p>
          )}
        </div>

        {/* ── Session recap ── */}
        {hasContent && (
          <div className={styles.recapSection}>
            {!recapText && !recapLoading && (
              <button className={styles.recapTrigger} onClick={fetchRecap}>
                <Sparkles size={13} className={styles.recapIcon} />
                Remind me where I left off
              </button>
            )}
            {(recapText || recapLoading) && (
              <div className={styles.recapCard}>
                <div className={styles.recapCardHeader}>
                  <Sparkles size={12} className={styles.recapCardIcon} />
                  <span className={styles.recapCardTitle}>Last Session</span>
                  {recapDone && (
                    <button className={styles.recapRefresh} onClick={fetchRecap} title="Refresh recap">
                      <RefreshCw size={11} />
                    </button>
                  )}
                </div>
                <p className={styles.recapText}>
                  {recapText}
                  {recapLoading && <span className={styles.recapCursor} />}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Recent scenes ── */}
        {ov && ov.recent_scenes.length > 1 && (
          <div className={styles.recentSection}>
            <h2 className={styles.sectionTitle}>Pick up where you left off</h2>
            <div className={styles.sceneCards}>
              {ov.recent_scenes.slice(0, 4).map((scene) => (
                <button
                  key={scene.id}
                  className={styles.sceneCard}
                  onClick={() => openScene(scene.id)}
                >
                  <span className={styles.sceneCardTitle}>{scene.title}</span>
                  <span className={styles.sceneCardMeta}>
                    {scene.word_count.toLocaleString()} words · {timeAgo(scene.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasContent && !loading && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              Your story awaits. Start by writing your first scene, or fill in the{" "}
              <button
                className={styles.inlineLink}
                onClick={() => navigate(`/stories/${storyId}/lorebook`)}
              >
                Lorebook
              </button>{" "}
              to ground your vision.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
