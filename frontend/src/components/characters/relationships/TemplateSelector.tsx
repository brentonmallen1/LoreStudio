import type { RelationshipTemplate } from "../../../types";
import styles from "./TemplateSelector.module.css";

interface Props {
  templates: RelationshipTemplate[];
  onSelect: (template: RelationshipTemplate) => void;
}

export default function TemplateSelector({ templates, onSelect }: Props) {
  return (
    <div className={styles.grid}>
      {templates.map((t) => (
        <button key={t.id} className={styles.card} type="button" onClick={() => onSelect(t)}>
          <span className={styles.name}>{t.name}</span>
          <span className={styles.hint}>{t.description_hint}</span>
          <div className={styles.tags}>
            {t.default_narrative_purpose.slice(0, 2).map((p) => (
              <span key={p} className={styles.tag}>
                {p}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
