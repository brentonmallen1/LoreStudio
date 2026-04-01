import type { StructureNode } from "../../types";
import styles from "./SceneCard.module.css";

interface Props {
  node: StructureNode;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDraggingOver: boolean;
}

export default function SceneCard({ node, onClick, onDragStart, onDragOver, onDrop, isDraggingOver }: Props) {
  const statusClass =
    node.status === "final"
      ? styles.final
      : node.status === "revised"
      ? styles.revised
      : styles.draft;

  return (
    <div
      className={`${styles.card} ${isDraggingOver ? styles.dragOver : ""}`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop(e); }}
    >
      <div className={`${styles.statusBar} ${statusClass}`} />
      <div className={styles.body}>
        <h3 className={styles.title}>{node.title}</h3>
        {node.synopsis && (
          <p className={styles.synopsis}>{node.synopsis}</p>
        )}
        <div className={styles.meta}>
          <span className={`${styles.statusBadge} ${statusClass}`}>{node.status}</span>
          {node.word_count > 0 && (
            <span className={styles.wordCount}>{node.word_count.toLocaleString()}w</span>
          )}
        </div>
      </div>
    </div>
  );
}
