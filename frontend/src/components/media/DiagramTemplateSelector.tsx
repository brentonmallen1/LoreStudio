import { X } from "lucide-react";
import { DIAGRAM_TEMPLATES, type DiagramTemplate } from "../../lib/diagramTemplates";
import styles from "./DiagramTemplateSelector.module.css";

interface Props {
  onSelect: (template: DiagramTemplate) => void;
  onClose: () => void;
}

export default function DiagramTemplateSelector({ onSelect, onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Start from a template</span>
          <button aria-label="Close" className={styles.closeBtn} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className={styles.grid}>
          {DIAGRAM_TEMPLATES.map((t) => (
            <button key={t.id} className={styles.card} onClick={() => onSelect(t)}>
              <span
                className={`${styles.typeBadge} ${t.type === "mindmap" ? styles.typeMindmap : styles.typeFlowchart}`}
              >
                {t.type}
              </span>
              <span className={styles.cardName}>{t.name}</span>
              <span className={styles.cardDesc}>{t.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
