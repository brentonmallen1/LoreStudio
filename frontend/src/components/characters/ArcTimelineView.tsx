import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Loader } from "lucide-react";
import { api } from "../../api/client";
import type { ArcTimelineData, ArcMilestone } from "../../types";
import styles from "./ArcTimelineView.module.css";

interface Props {
  characterId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:    "var(--status-draft, #9ca3af)",
  revised:  "var(--status-revised, #60a5fa)",
  final:    "var(--status-final, #34d399)",
};

export default function ArcTimelineView({ characterId }: Props) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ArcTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredScene, setHoveredScene] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getArcTimeline(characterId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [characterId]);

  function navigateToScene(_sceneId: string) {
    if (!storyId) return;
    navigate(`/stories/${storyId}/write`);
    // Scene navigation via storyStore is handled by the write route
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader size={14} className={styles.spinner} />
        Loading timeline…
      </div>
    );
  }

  if (!data || data.scenes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No scenes found featuring this character yet.</p>
        <p className={styles.emptyHint}>
          Scenes are detected by character name appearing in prose.
        </p>
      </div>
    );
  }

  const linkedMilestoneIds = new Set(data.milestones.filter((m) => m.scene_id).map((m) => m.scene_id));

  // Build a lookup: scene_id → milestones linked there
  const milestonesByScene: Record<string, ArcMilestone[]> = {};
  for (const m of data.milestones) {
    if (m.scene_id) {
      if (!milestonesByScene[m.scene_id]) milestonesByScene[m.scene_id] = [];
      milestonesByScene[m.scene_id].push(m);
    }
  }

  const completedCount = data.milestones.filter((m) => m.completed).length;
  const totalMilestones = data.milestones.length;

  return (
    <div className={styles.container}>
      {/* Stats row */}
      <div className={styles.statsRow}>
        <span className={styles.stat}>
          <strong>{data.scenes.length}</strong> appearances
        </span>
        <span className={styles.statDivider}>·</span>
        <span className={styles.stat}>
          <strong>{data.appearance_rate}%</strong> of scenes
        </span>
        {totalMilestones > 0 && (
          <>
            <span className={styles.statDivider}>·</span>
            <span className={styles.stat}>
              <strong>{completedCount}/{totalMilestones}</strong> milestones completed
            </span>
          </>
        )}
      </div>

      {/* Timeline */}
      <div className={styles.timelineWrap}>
        <div className={styles.timeline}>
          {/* Connector line */}
          <div className={styles.connectorLine} />

          {data.scenes.map((scene, idx) => {
            const hasMilestone = linkedMilestoneIds.has(scene.id);
            const sceneMilestones = milestonesByScene[scene.id] ?? [];
            const isHovered = hoveredScene === scene.id;
            const color = STATUS_COLORS[scene.status] ?? STATUS_COLORS.draft;

            return (
              <div
                key={scene.id}
                className={styles.sceneSlot}
                onMouseEnter={() => setHoveredScene(scene.id)}
                onMouseLeave={() => setHoveredScene(null)}
              >
                {/* Milestone flag above */}
                {hasMilestone && (
                  <div className={styles.milestoneFlags}>
                    {sceneMilestones.map((m) => (
                      <span
                        key={m.id}
                        className={`${styles.milestoneFlag} ${m.completed ? styles.milestoneDone : ""}`}
                        title={m.text}
                      >
                        <MapPin size={8} />
                        <span className={styles.milestoneFlagText}>{m.text}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Scene dot */}
                <button
                  className={styles.sceneDot}
                  style={{ borderColor: color, background: isHovered ? color : "var(--color-surface)" }}
                  onClick={() => navigateToScene(scene.id)}
                  title={`${scene.title} (${scene.word_count} words)`}
                  aria-label={scene.title}
                />

                {/* Scene index */}
                <span className={styles.sceneIndex}>{idx + 1}</span>

                {/* Tooltip */}
                {isHovered && (
                  <div className={styles.tooltip}>
                    <span className={styles.tooltipTitle}>{scene.title}</span>
                    <span className={styles.tooltipMeta}>{scene.word_count} words · {scene.status}</span>
                    {sceneMilestones.length > 0 && (
                      <div className={styles.tooltipMilestones}>
                        {sceneMilestones.map((m) => (
                          <span key={m.id} className={styles.tooltipMilestone}>
                            {m.completed ? "✓" : "○"} {m.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unlinked milestones */}
      {data.milestones.filter((m) => !m.scene_id).length > 0 && (
        <div className={styles.unlinked}>
          <span className={styles.unlinkedLabel}>Milestones not yet linked to a scene:</span>
          <div className={styles.unlinkedList}>
            {data.milestones.filter((m) => !m.scene_id).map((m) => (
              <span key={m.id} className={`${styles.unlinkedMilestone} ${m.completed ? styles.unlinkedDone : ""}`}>
                {m.completed ? "✓" : "○"} {m.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
