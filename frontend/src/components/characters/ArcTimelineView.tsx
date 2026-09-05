import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Loader } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import MentionReviewPanel from "./MentionReviewPanel";
import type { ArcTimelineData, ArcMilestone, StructureNode } from "../../types";
import styles from "./ArcTimelineView.module.css";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

interface Props {
  characterId: string;
  characterName: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--status-draft, #9ca3af)",
  revised: "var(--status-revised, #60a5fa)",
  final: "var(--status-final, #34d399)",
};

export default function ArcTimelineView({ characterId, characterName }: Props) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { structure, setActiveNode, upsertCharacter } = useStoryStore();
  const [data, setData] = useState<ArcTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredScene, setHoveredScene] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const [sceneNodes, setSceneNodes] = useState<StructureNode[]>([]);

  useEffect(() => {
    setLoading(true);
    api
      .getArcTimeline(characterId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [characterId]);

  useEffect(() => {
    const leaves: StructureNode[] = [];
    function walk(nodes: StructureNode[]) {
      for (const n of nodes) {
        if (!n.children?.length) leaves.push(n);
        else walk(n.children);
      }
    }
    walk(structure);
    setSceneNodes(leaves);
  }, [structure]);

  async function linkMilestoneToScene(milestoneId: string, sceneId: string, sceneTitle: string) {
    const m = data?.milestones.find((x) => x.id === milestoneId);
    if (!m) return;
    const updated = await api.updateMilestone(characterId, milestoneId, {
      text: m.text,
      completed: m.completed,
      scene_id: sceneId || null,
      scene_title: sceneId ? sceneTitle : null,
    });
    upsertCharacter(updated);
    api
      .getArcTimeline(characterId)
      .then(setData)
      .catch(() => {});
  }

  function findNode(id: string, nodes: StructureNode[]): StructureNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNode(id, n.children);
        if (found) return found;
      }
    }
    return null;
  }

  function navigateToScene(sceneId: string) {
    if (!storyId) return;
    const node = findNode(sceneId, structure);
    if (node) setActiveNode(node);
    navigate(`/stories/${storyId}/write`);
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
        <p className={styles.emptyHint}>Scenes are detected by character name appearing in prose.</p>
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
              <strong>
                {completedCount}/{totalMilestones}
              </strong>{" "}
              milestones completed
            </span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legendRow}>
        <span className={styles.legendHint}>
          Each dot is a scene where {characterName} appears — click to open it
        </span>
        <div className={styles.legendItems}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ borderColor: color }} />
              {STATUS_LABELS[status]}
            </span>
          ))}
          <span className={styles.legendSep} />
          <span className={styles.legendItem}>
            <MapPin size={8} className={styles.legendMilestoneIcon} />
            Milestone
          </span>
        </div>
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
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setHoveredScene(scene.id);
                  setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top });
                }}
                onMouseLeave={() => {
                  setHoveredScene(null);
                  setTooltipAnchor(null);
                }}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip portal — renders into document.body to escape overflow clipping */}
      {hoveredScene &&
        tooltipAnchor &&
        (() => {
          const scene = data.scenes.find((s) => s.id === hoveredScene);
          const sceneMilestones = scene ? (milestonesByScene[scene.id] ?? []) : [];
          if (!scene) return null;
          return createPortal(
            <div className={styles.tooltipPortal} style={{ left: tooltipAnchor.x, top: tooltipAnchor.y }}>
              <span className={styles.tooltipTitle}>{scene.title}</span>
              <span className={styles.tooltipMeta}>
                {scene.word_count} words · {scene.status}
              </span>
              {sceneMilestones.length > 0 && (
                <div className={styles.tooltipMilestones}>
                  {sceneMilestones.map((m) => (
                    <span key={m.id} className={styles.tooltipMilestone}>
                      {m.completed ? "✓" : "○"} {m.text}
                    </span>
                  ))}
                </div>
              )}
            </div>,
            document.body,
          );
        })()}

      {/* Mention Discovery */}
      <div className={styles.mentionSection}>
        <div className={styles.mentionHeader}>
          <span className={styles.mentionTitle}>Mention Discovery</span>
          <span className={styles.mentionHint}>Scan scenes for untagged references to {characterName}</span>
        </div>
        <MentionReviewPanel
          characterId={characterId}
          characterName={characterName}
          onApplied={() => {
            api
              .getArcTimeline(characterId)
              .then(setData)
              .catch(() => {});
          }}
        />
      </div>

      {/* Unlinked milestones */}
      {data.milestones.filter((m) => !m.scene_id).length > 0 && (
        <div className={styles.unlinked}>
          <span className={styles.unlinkedLabel}>Milestones not yet linked to a scene:</span>
          <div className={styles.unlinkedList}>
            {data.milestones
              .filter((m) => !m.scene_id)
              .map((m) => (
                <div
                  key={m.id}
                  className={`${styles.unlinkedMilestoneItem} ${m.completed ? styles.unlinkedDone : ""}`}
                >
                  <span className={styles.unlinkedCheck}>{m.completed ? "✓" : "○"}</span>
                  <span className={styles.unlinkedMilestoneText}>{m.text}</span>
                  {sceneNodes.length > 0 && (
                    <select
                      className={styles.unlinkedScenePicker}
                      value=""
                      onChange={(e) => {
                        const node = sceneNodes.find((n) => n.id === e.target.value);
                        linkMilestoneToScene(m.id, e.target.value, node?.title ?? "");
                      }}
                      title="Link to scene"
                    >
                      <option value="">— link to scene —</option>
                      {sceneNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title || "Untitled"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
