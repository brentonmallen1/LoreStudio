import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../../api/client";
import type { ActivityLog } from "../../types";
import ReportCard from "./ReportCard";
import styles from "./ReportsView.module.css";

const FEATURE_FILTERS = [
  { id: "all", label: "All" },
  { id: "prose-analysis", label: "Prose" },
  { id: "economy-analysis", label: "Economy" },
  { id: "essential-questions", label: "Story Compass" },
  { id: "entity-suggestions", label: "Entities" },
];

interface Props {
  storyId: string;
}

export default function ReportsView({ storyId }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    api.getAnalysisHistory(storyId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [storyId]);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.metadata_?.feature === filter);

  return (
    <div className={styles.view}>
      <div className={styles.filterBar}>
        {FEATURE_FILTERS.map((f) => (
          <button
            key={f.id}
            className={`${styles.filterBtn} ${filter === f.id ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id !== "all" && (
              <span className={styles.filterCount}>
                {logs.filter((l) => l.metadata_?.feature === f.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Loader2 size={14} className={styles.spinner} />
          <span>Loading reports…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No reports yet</p>
          <p className={styles.emptyHint}>
            Run an analysis from the toolbar above to generate a report.
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((log) => (
            <ReportCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
