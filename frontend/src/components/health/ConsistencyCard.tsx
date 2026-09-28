import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanSearch } from "lucide-react";
import { toolsApi } from "../../api/tools";
import type { ConsistencyFinding } from "../../types/tools";
import page from "../../pages/StoryHealthPage.module.css";
import styles from "./ConsistencyCard.module.css";

const KIND_LABEL: Record<string, string> = {
  name_drift: "name spellings",
  unknown_speaker: "unknown speakers",
  pov_drift: "point-of-view drift",
};

const SHOWN = 6;

/**
 * Consistency across the whole story, on the Story Health dashboard: the name, speaker
 * and point-of-view checks that were only visible one scene at a time in the Notes panel.
 * Deterministic, so it wears the NLP colour, and it is here in both modes.
 */
export default function ConsistencyCard({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<ConsistencyFinding[] | null>(null);

  useEffect(() => {
    let live = true;
    toolsApi
      .consistencyChecks(storyId)
      .then((r) => live && setFindings(r.findings))
      .catch(() => live && setFindings([]));
    return () => {
      live = false;
    };
  }, [storyId]);

  if (findings === null) return null;
  const counts = findings.reduce<Record<string, number>>(
    (acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }),
    {},
  );

  return (
    <section className={page.card}>
      <div className={page.cardHeader}>
        <ScanSearch size={14} className={`${page.cardIcon} ${styles.nlp}`} />
        <h3 className={page.cardTitle}>Consistency</h3>
      </div>
      <p className={page.bigStat}>{findings.length}</p>
      <p className={styles.summary}>
        {findings.length === 0
          ? "No name, speaker or point-of-view problems found."
          : Object.entries(counts)
              .map(([kind, n]) => `${n} ${KIND_LABEL[kind] ?? kind}`)
              .join(" · ")}
      </p>
      {findings.length > 0 && (
        <ul className={styles.list}>
          {findings.slice(0, SHOWN).map((f, i) => (
            <li key={`${f.node_id}-${i}`}>
              <button
                type="button"
                className={styles.finding}
                onClick={() => navigate(`/stories/${storyId}/write?node=${f.node_id}`)}
                title={f.excerpt}
              >
                <span className={styles.text}>
                  {f.kind === "name_drift" ? `${f.text} → ${f.suggestion}` : f.suggestion || f.text}
                </span>
                <span className={styles.scene}>{f.node_title}</span>
              </button>
            </li>
          ))}
          {findings.length > SHOWN && (
            <li className={styles.more}>
              and {findings.length - SHOWN} more — each scene's Notes panel lists its own
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
