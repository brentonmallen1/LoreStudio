import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { sceneLeaves } from "../../lib/planning/methods";
import { sceneSheetPath } from "../../lib/scene/glance";
import { sceneStatus } from "../../lib/outline/status";
import { timeColumns } from "../../lib/outline/cards";
import { movedPositions, timelineRows } from "../../lib/timeline";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { Era, StructureNode } from "../../types";
import CardColumns from "./CardColumns";
import OutlineMark from "./OutlineMark";
import styles from "./Outline.module.css";

/**
 * The Cards as it happens (doc 29 D2): the scenes placed in time, a column per era (or one,
 * with no eras), then the scenes not placed yet, in reading order. Drag a card among the
 * placed ones, or drop one not placed yet on a card, to say when it happens.
 */
export default function OutlineTimeCards({ storyId }: { storyId: string }) {
  const { structure, setStructure, activeTemplate } = useStoryStore();
  const [eras, setEras] = useState<Era[]>([]);
  const dragged = useRef<string | null>(null);
  useEffect(() => {
    api
      .listEras(storyId)
      .then(setEras)
      .catch(() => {});
  }, [storyId]);
  useReloadOnUndo(["era"], () => api.listEras(storyId).then(setEras));

  const { placed, unplaced } = timelineRows(sceneLeaves(structure, activeTemplate), eras);
  const columns = timeColumns(placed, unplaced);
  const order = placed.map((r) => r.node);

  async function placeAt(id: string, targetId: string) {
    const from = order.findIndex((n) => n.id === id);
    const to = order.findIndex((n) => n.id === targetId);
    if (to < 0 || from === to) return;
    const list: StructureNode[] = from < 0 ? [...order, unplaced.find((r) => r.node.id === id)!.node] : order;
    const positions = movedPositions(list, from < 0 ? list.length - 1 : from, to);
    try {
      for (const node of list) {
        const at = positions.get(node.id);
        if (at !== undefined && node.timeline_position !== at)
          await api.updateNode(node.id, { timeline_position: at });
      }
      setStructure(await api.getStructure(storyId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The order could not be saved.");
    }
  }

  return (
    <div className={styles.cardsWrap}>
      <CardColumns label="The scenes as it happens, a column each">
        {columns.map((col) => (
          <section key={col.key} className={styles.column} aria-label={col.title}>
            <h3 className={styles.columnTitle}>{col.title}</h3>
            {col.hint && <p className={styles.columnEmpty}>{col.hint}</p>}
            {col.rows.map((row) => (
              <Link
                key={row.node.id}
                to={sceneSheetPath(storyId, row.node.id)}
                className={styles.card}
                draggable
                onDragStart={(e) => {
                  dragged.current = row.node.id;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", row.node.title);
                }}
                onDragOver={(e) => {
                  if (dragged.current && col.placed) e.preventDefault();
                }}
                onDrop={(e) => {
                  const from = dragged.current;
                  dragged.current = null;
                  if (!from || !col.placed) return;
                  e.preventDefault();
                  void placeAt(from, row.node.id);
                }}
              >
                <span className={styles.cardHead}>
                  <OutlineMark status={sceneStatus(row.node)} />
                  <span className={styles.cardTitle}>{row.node.title || "Untitled scene"}</span>
                </span>
                {row.node.synopsis && <span className={styles.cardWhat}>{row.node.synopsis}</span>}
                <span className={styles.cardMeta}>
                  {[row.node.in_world_date?.trim(), row.outOfOrder ? `read ${ordinal(row.readingRank)}` : ""]
                    .filter(Boolean)
                    .join(" · ") || (col.placed ? "" : `read ${ordinal(row.readingRank)}`)}
                </span>
              </Link>
            ))}
          </section>
        ))}
      </CardColumns>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
