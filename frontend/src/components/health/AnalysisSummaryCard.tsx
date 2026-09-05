import { useEffect, useState } from "react";
import { AlignLeft, Compass, HelpCircle, Search } from "lucide-react";
import { api } from "../../api/client";
import type { ActivityLog } from "../../types";
import styles from "./AnalysisSummaryCard.module.css";

interface FeatureDef {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  summarize: (log: ActivityLog) => string;
}

const FEATURES: FeatureDef[] = [
  {
    id: "prose-analysis",
    label: "Prose",
    Icon: AlignLeft,
    color: "var(--color-nlp)",
    summarize: (log) => {
      const w = log.metadata_?.warning_count as number | undefined;
      const s = log.metadata_?.scene_count as number | undefined;
      if (w == null || s == null) return log.description;
      return w === 0 ? `${s} scenes — clean` : `${s} scenes — ${w} warning${w !== 1 ? "s" : ""}`;
    },
  },
  {
    id: "economy-analysis",
    label: "Economy",
    Icon: Compass,
    color: "var(--color-accent)",
    summarize: () => "Analysis run",
  },
  {
    id: "essential-questions",
    label: "Story Compass",
    Icon: HelpCircle,
    color: "var(--color-accent)",
    summarize: (log) => {
      const name = log.metadata_?.character_name as string | undefined;
      return name ? `Analyzed for ${name}` : "Analysis run";
    },
  },
  {
    id: "entity-suggestions",
    label: "Entities",
    Icon: Search,
    color: "var(--color-nlp)",
    summarize: (log) => {
      const c = log.metadata_?.character_count as number | undefined;
      const l = log.metadata_?.location_count as number | undefined;
      if (c == null || l == null) return log.description;
      const total = c + l;
      return total === 0 ? "No new entities" : `${total} potential entr${total !== 1 ? "ies" : "y"}`;
    },
  },
];

function formatAge(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) {
    const mins = Math.round(diffMs / 60000);
    return mins <= 0 ? "just now" : `${mins}m ago`;
  }
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

interface Props {
  storyId: string;
}

export default function AnalysisSummaryCard({ storyId }: Props) {
  const [latest, setLatest] = useState<Record<string, ActivityLog | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all(FEATURES.map((f) => api.getLatestAnalysis(storyId, f.id).catch(() => null))).then(
      (results) => {
        const map: Record<string, ActivityLog | null> = {};
        FEATURES.forEach((f, i) => {
          map[f.id] = results[i];
        });
        setLatest(map);
        setLoading(false);
      },
    );
  }, [storyId]);

  const hasAny = Object.values(latest).some(Boolean);

  if (!loading && !hasAny) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyHeader}>
          <span className={styles.emptyTitle}>No analyses run yet</span>
          <span className={styles.emptyHint}>Use the toolbar above to run an analysis</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {FEATURES.map((feature) => {
        const log = latest[feature.id];
        return (
          <div key={feature.id} className={styles.row}>
            <feature.Icon size={12} style={{ color: feature.color, flexShrink: 0 }} />
            <span className={styles.featureLabel}>{feature.label}</span>
            {loading ? (
              <span className={styles.skeleton} />
            ) : log ? (
              <>
                <span className={styles.summary}>{feature.summarize(log)}</span>
                <span className={styles.age}>{formatAge(log.created_at)}</span>
              </>
            ) : (
              <span className={styles.none}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
