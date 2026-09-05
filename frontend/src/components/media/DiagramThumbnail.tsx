import { Network, GitFork, ExternalLink } from "lucide-react";
import type { DiagramSummary } from "../../types";
import styles from "./DiagramThumbnail.module.css";

interface Props {
  diagram: DiagramSummary;
  onClick?: () => void;
}

export default function DiagramThumbnail({ diagram, onClick }: Props) {
  const Icon = diagram.diagram_type === "mindmap" ? Network : GitFork;

  return (
    <button className={styles.card} onClick={onClick} title={diagram.description || `Open: ${diagram.title}`}>
      <div
        className={`${styles.preview} ${diagram.diagram_type === "mindmap" ? styles.previewMindmap : styles.previewFlowchart}`}
      >
        <Icon size={22} className={styles.previewIcon} />
      </div>
      <div className={styles.info}>
        <span className={styles.type}>{diagram.diagram_type}</span>
        <span className={styles.title}>{diagram.title}</span>
      </div>
      <ExternalLink size={11} className={styles.openIcon} />
    </button>
  );
}
