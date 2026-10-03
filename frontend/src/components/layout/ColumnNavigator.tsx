import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import { pathTo } from "./structureTreeMeta";
import styles from "./BreadcrumbNav.module.css";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/**
 * Acts | Chapters | Scenes as columns, with a preview of the chosen scene's opening lines:
 * the other way in when the strip is collapsed. Hover moves down the columns; click opens.
 */
export default function ColumnNavigator({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { structure, activeNode, activeTemplate, sceneCast } = useStoryStore();
  const depth = activeTemplate && !activeTemplate.flat ? activeTemplate.levels.length : 1;
  const [picked, setPicked] = useState<string[]>(() =>
    activeNode ? (pathTo(structure, activeNode.id) ?? []).map((n) => n.id) : [],
  );

  const columns: { heading: string; nodes: StructureNode[]; level: number }[] = [];
  let pool: StructureNode[] = structure;
  for (let level = 0; level < depth; level++) {
    if (pool.length === 0) break;
    columns.push({
      heading: activeTemplate?.levels[level]?.plural ?? activeTemplate?.levels[level]?.name ?? "Scenes",
      nodes: pool,
      level,
    });
    const chosen = pool.find((n) => n.id === picked[level]) ?? pool[0];
    pool = chosen?.children ?? [];
  }
  const leafColumn = columns[columns.length - 1];
  const previewNode = leafColumn
    ? (leafColumn.nodes.find((n) => n.id === picked[leafColumn.level]) ?? leafColumn.nodes[0])
    : undefined;
  const cast = previewNode ? sceneCast?.scenes.find((s) => s.node_id === previewNode.id) : undefined;
  const go = (id: string) => {
    onClose();
    navigate(`/stories/${storyId}/write/${id}`);
  };

  return (
    <div className={styles.navigator} role="dialog" aria-label="Go to a scene">
      {columns.map((col) => (
        <div key={col.level} className={styles.column}>
          <div className={styles.colHead}>{col.heading}</div>
          {col.nodes.map((n) => {
            const on = (picked[col.level] ?? col.nodes[0]?.id) === n.id;
            const current = activeNode?.id === n.id;
            return (
              <button
                key={n.id}
                className={`${styles.item} ${on ? styles.itemOn : ""} ${n.status === "planned" ? styles.itemPlanned : ""}`}
                onMouseEnter={() => setPicked((p) => [...p.slice(0, col.level), n.id])}
                onClick={() => go(n.id)}
              >
                <span className={`${styles.mark} ${current ? styles.markOn : ""}`} />
                <span className={styles.itemLabel} title={n.title}>
                  {n.title}
                </span>
                {!n.children?.length && n.word_count > 0 && (
                  <span className={styles.itemMeta}>{fmt(n.word_count)}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
      {previewNode && (
        <div className={styles.preview}>
          <div className={styles.colHead}>
            {previewNode.status === "planned"
              ? "Planned"
              : `${fmt(previewNode.word_count ?? 0)} words · ${previewNode.status}`}
          </div>
          <div className={styles.previewTitle}>{previewNode.title}</div>
          {previewNode.synopsis && <p className={styles.previewText}>{previewNode.synopsis}</p>}
          {cast?.opening && <p className={styles.previewOpening}>{cast.opening}</p>}
          <button className={styles.open} onClick={() => go(previewNode.id)}>
            Open {previewNode.title}
          </button>
        </div>
      )}
    </div>
  );
}
