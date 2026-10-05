import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { sceneLeaves } from "../../lib/planning/methods";
import { movedPositions, timelineRows, type TimelineRow } from "../../lib/timeline";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { Era } from "../../types";
import styles from "./TimelineView.module.css";

/**
 * The story in the order it happened (the Plan's Timeline, series v2): each scene placed on
 * the timeline, with its date and era, against the order the reader meets it. A scene the
 * reader meets out of order is marked; eras band the scenes they hold. Drag a scene, or move
 * it with its arrows; a scene not placed yet waits below.
 */
export default function TimelineView({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const { structure, setStructure, activeTemplate } = useStoryStore();
  const [eras, setEras] = useState<Era[]>([]);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    api
      .listEras(storyId)
      .then(setEras)
      .catch(() => {});
  }, [storyId]);
  useReloadOnUndo(["era"], () => api.listEras(storyId).then(setEras));

  // The scenes as the Plan reads them: an act with nothing in it yet is not a scene.
  const { placed, unplaced } = timelineRows(sceneLeaves(structure, activeTemplate), eras);

  async function save(positions: Map<string, number>) {
    try {
      for (const row of [...placed, ...unplaced]) {
        const at = positions.get(row.node.id);
        if (at !== undefined && row.node.timeline_position !== at)
          await api.updateNode(row.node.id, { timeline_position: at });
      }
      setStructure(await api.getStructure(storyId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The timeline could not be saved.");
    }
  }

  const move = (from: number, to: number) =>
    save(
      movedPositions(
        placed.map((r) => r.node),
        from,
        to,
      ),
    );
  const place = (row: TimelineRow) => save(new Map([[row.node.id, placed.length + 1]]));

  if (placed.length + unplaced.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          No scenes yet. Once there are, place them here in the order they happen.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.inner}>
        {placed.length === 0 && (
          <p className={styles.emptyText}>
            Nothing placed yet. Place the scenes below in the order they happen; until then they read in the
            order the reader meets them.
          </p>
        )}
        {placed.map((row, idx) => (
          <div key={row.node.id} className={styles.placedItem}>
            {row.eraStarts && row.era && (
              <div className={styles.eraBand}>
                <span className={styles.eraName}>{row.era.name}</span>
                {(row.era.start_date || row.era.end_date) && (
                  <span className={styles.eraDates}>
                    {[row.era.start_date, row.era.end_date].filter(Boolean).join(" – ")}
                  </span>
                )}
              </div>
            )}
            <div
              className={styles.row}
              draggable
              onDragStart={() => {
                dragIdx.current = idx;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx.current !== null && dragIdx.current !== idx) void move(dragIdx.current, idx);
                dragIdx.current = null;
              }}
            >
              <div className={styles.positionCol}>
                <span className={styles.posNum}>{idx + 1}</span>
              </div>
              <SceneCard row={row} onOpen={() => navigate(`/stories/${storyId}/write/${row.node.id}`)} />
              <div className={styles.moveCol}>
                <button
                  className={styles.moveBtn}
                  disabled={idx === 0}
                  onClick={() => move(idx, idx - 1)}
                  aria-label={`${row.node.title} happens earlier`}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  className={styles.moveBtn}
                  disabled={idx === placed.length - 1}
                  onClick={() => move(idx, idx + 1)}
                  aria-label={`${row.node.title} happens later`}
                >
                  <ArrowDown size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {unplaced.length > 0 && (
          <>
            <p className={styles.unplacedHead}>Not on the timeline yet, in reading order</p>
            {unplaced.map((row) => (
              <div key={row.node.id} className={`${styles.row} ${styles.rowUnset}`}>
                <div className={styles.positionCol}>
                  <span className={styles.unsetLabel}>–</span>
                </div>
                <SceneCard row={row} onOpen={() => navigate(`/stories/${storyId}/write/${row.node.id}`)} />
                <button className={styles.setPositionBtn} onClick={() => place(row)}>
                  Place it next
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SceneCard({ row, onOpen }: { row: TimelineRow; onOpen: () => void }) {
  const { node } = row;
  const when = [node.in_world_date?.trim(), row.era?.name].filter(Boolean).join(" · ");
  return (
    <button className={styles.card} onClick={onOpen}>
      <span className={styles.cardTop}>
        <span className={styles.cardTitle}>{node.title}</span>
        {row.outOfOrder && (
          <span
            className={styles.reorderedBadge}
            title="The reader meets this scene out of the order it happens"
          >
            Out of order · read {ordinal(row.readingRank)}
          </span>
        )}
      </span>
      {when && <span className={styles.parentLabel}>{when}</span>}
      {node.synopsis && <span className={styles.synopsis}>{node.synopsis}</span>}
    </button>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
