import { Clock } from "lucide-react";
import { api } from "../../api/client";
import type { TimelineFilter } from "../../api/chronicle";
import { jobsApi } from "../../api/jobs";
import { useTimeline } from "../../hooks/useTimeline";
import type { ActivityLog } from "../../types";
import TimelineRow from "./TimelineRow";
import { groupByDay } from "./timelineFormat";
import type { ChronicleItem } from "./useChronicleParams";
import styles from "./Timeline.module.css";

const FILTERS: { id: TimelineFilter; label: string; hint: string; ai?: boolean }[] = [
  { id: "all", label: "Everything", hint: "Every call, job and analysis, newest first" },
  { id: "problems", label: "Problems", hint: "Calls and jobs that failed or were stopped" },
  { id: "results", label: "Results", hint: "Summaries, analyses and brainstorms worth keeping", ai: true },
  { id: "starred", label: "Starred", hint: "Rows you starred" },
];

const EMPTY: Record<TimelineFilter, string> = {
  all: "Nothing has happened in this story yet. AI calls, background jobs and analyses will appear here as they run.",
  problems: "No problems. Nothing failed and nothing was stopped.",
  results: "No summaries or analyses yet.",
  starred: "Nothing starred. Star a row to keep it here.",
};

interface Props {
  storyId: string;
  filter: TimelineFilter;
  q: string;
  aiAvailable: boolean;
  selected: ChronicleItem | null;
  onSelect: (kind: "job" | "log", id: string) => void;
  onFilter: (filter: TimelineFilter) => void;
}

/**
 * Chronicle › Activity: one timeline, grouped by day. A job is a row of its own and the
 * calls it made open from it, so a manuscript's worth of summaries is one line, not forty.
 */
export default function ActivityView({
  storyId,
  filter,
  q,
  aiAvailable,
  selected,
  onSelect,
  onFilter,
}: Props) {
  const { entries, total, hasMore, loadMore, reload } = useTimeline({
    story_id: storyId,
    filter,
    q: q || undefined,
    exclude_ai: !aiAvailable,
  });

  async function star(log: ActivityLog) {
    await api.updateActivityLog(log.id, { starred: !log.starred });
    reload();
  }

  const filters = FILTERS.filter((f) => aiAvailable || !f.ai);

  return (
    <>
      <div className={styles.filters} role="radiogroup" aria-label="Show">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            className={`${styles.filter} ${filter === f.id ? styles.filterOn : ""}`}
            onClick={() => onFilter(f.id)}
            title={f.hint}
          >
            {f.label}
          </button>
        ))}
        {entries && (
          <span className={styles.count}>
            {total} {total === 1 ? "entry" : "entries"}
            {filter === "all" && !q ? "" : " match"}
          </span>
        )}
      </div>

      {entries === null ? (
        <p className={styles.empty}>Loading…</p>
      ) : entries.length === 0 ? (
        <p className={styles.empty}>
          {q
            ? `Nothing matches “${q}”.`
            : filter === "all" && !aiAvailable
              ? "Nothing has happened in this story yet. Analyses and checks will appear here as they run."
              : EMPTY[filter]}
        </p>
      ) : (
        groupByDay(entries).map(([day, rows]) => (
          <section key={day} className={styles.day} aria-label={day}>
            <h3 className={styles.dayLabel}>{day}</h3>
            <div className={styles.rows}>
              {rows.map((entry) => {
                const kind = entry.job ? "job" : "log";
                const id = entry.job ? entry.job.id : entry.log.id;
                return (
                  <TimelineRow
                    key={`${kind}:${id}`}
                    entry={entry}
                    selected={selected?.kind === kind && selected.id === id}
                    onSelect={() => onSelect(kind, id)}
                    onStar={star}
                    onStop={async (job) => {
                      await jobsApi.cancel(job.id);
                      reload();
                    }}
                  />
                );
              })}
            </div>
          </section>
        ))
      )}

      {hasMore && (
        <button type="button" className={styles.loadMore} onClick={loadMore}>
          <Clock size={13} /> Show older
        </button>
      )}
    </>
  );
}
