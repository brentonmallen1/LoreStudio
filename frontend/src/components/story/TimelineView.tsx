import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import styles from "./TimelineView.module.css";

function flattenLeaves(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    if (!n.children || n.children.length === 0) {
      result.push(n);
    } else {
      n.children.forEach(walk);
    }
  }
  nodes.forEach(walk);
  return result;
}

function buildNodeMap(nodes: StructureNode[]): Map<string, StructureNode> {
  const map = new Map<string, StructureNode>();
  function walk(n: StructureNode) {
    map.set(n.id, n);
    (n.children ?? []).forEach(walk);
  }
  nodes.forEach(walk);
  return map;
}

function getParentLabel(node: StructureNode, nodeMap: Map<string, StructureNode>): string {
  const path: string[] = [];
  let current = node.parent_id ? nodeMap.get(node.parent_id) : null;
  while (current) {
    path.unshift(current.title);
    current = current.parent_id ? nodeMap.get(current.parent_id) : null;
  }
  return path.join(" › ");
}

export default function TimelineView() {
  const navigate = useNavigate();
  const { storyId } = useParams<{ storyId: string }>();
  const { structure, setStructure, setActiveNode } = useStoryStore();

  const dragIdx = useRef<number | null>(null);

  // Collect leaf nodes in narrative (depth-first) order
  const allLeaves = flattenLeaves(structure);
  const nodeMap = buildNodeMap(structure);

  // Build narrative rank map (1-indexed position in depth-first traversal)
  const narrativeRankMap = new Map<string, number>();
  allLeaves.forEach((n, i) => narrativeRankMap.set(n.id, i + 1));

  // Split into positioned (sorted) and unset
  const positioned = allLeaves
    .filter((n) => n.timeline_position != null)
    .sort((a, b) => a.timeline_position! - b.timeline_position!);
  const unset = allLeaves.filter((n) => n.timeline_position == null);
  const sortedScenes = [...positioned, ...unset];

  const maxPosition = positioned.length > 0 ? Math.max(...positioned.map((n) => n.timeline_position!)) : 0;

  async function assignPosition(node: StructureNode) {
    await api.updateNode(node.id, { timeline_position: maxPosition + 1 });
    const updated = await api.getStructure(storyId!);
    setStructure(updated);
  }

  async function handleDrop(toIdx: number) {
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === toIdx) return;

    // Only reorder within the positioned section
    const posCount = positioned.length;
    if (fromIdx >= posCount || toIdx >= posCount) return;

    const reordered = [...positioned];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Assign sequential timeline_position (1-based)
    for (let i = 0; i < reordered.length; i++) {
      const newPos = i + 1;
      if (reordered[i].timeline_position !== newPos) {
        await api.updateNode(reordered[i].id, { timeline_position: newPos });
      }
    }

    const updated = await api.getStructure(storyId!);
    setStructure(updated);
    dragIdx.current = null;
  }

  if (allLeaves.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No scenes yet. Add sections in the tree view to get started.</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.inner}>
        {sortedScenes.map((node, idx) => {
          const isUnset = node.timeline_position == null;
          const narrativeRank = narrativeRankMap.get(node.id) ?? null;
          const isReordered = !isUnset && narrativeRank !== null && node.timeline_position !== narrativeRank;
          const parentLabel = getParentLabel(node, nodeMap);

          return (
            <div
              key={node.id}
              className={`${styles.row} ${isUnset ? styles.rowUnset : ""}`}
              draggable={!isUnset}
              onDragStart={() => {
                dragIdx.current = idx;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
            >
              <div className={styles.positionCol}>
                {isUnset ? (
                  <span className={styles.unsetLabel}>Unset</span>
                ) : (
                  <span className={styles.posNum}>{node.timeline_position}</span>
                )}
              </div>
              <div
                className={styles.card}
                onClick={() => {
                  setActiveNode(node);
                  navigate(`/stories/${storyId}`);
                }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{node.title}</span>
                  {isReordered && <span className={styles.reorderedBadge}>⇄ Reordered</span>}
                </div>
                {parentLabel && <span className={styles.parentLabel}>{parentLabel}</span>}
                <div className={styles.cardMeta}>
                  <span className={`${styles.statusBadge} ${styles[node.status]}`}>{node.status}</span>
                  {node.word_count > 0 && (
                    <span className={styles.wordCount}>{node.word_count.toLocaleString()}w</span>
                  )}
                </div>
              </div>
              {isUnset && (
                <button
                  className={styles.setPositionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    assignPosition(node);
                  }}
                >
                  + Set position
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
