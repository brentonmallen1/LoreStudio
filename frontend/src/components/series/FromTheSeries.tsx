import { useState } from "react";
import { Plus } from "lucide-react";
import { seriesApi, type SeriesKind } from "../../api/series";
import { refreshBookLists } from "../../lib/series/refresh";
import { bookList, useSeriesStore } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import styles from "./Series.module.css";

/**
 * The end of a Lorebook list in a book of a series (series doc): what the series shares
 * that this book does not have yet, each a click from being brought in where it last stood.
 */
export default function FromTheSeries({
  kinds,
  onAdded,
}: {
  kinds: SeriesKind[];
  onAdded?: (refId: string) => void;
}) {
  const storyId = useSeriesStore((s) => s.storyId);
  const series = useSeriesStore((s) => s.series);
  const [busy, setBusy] = useState<string | null>(null);
  if (!series || !storyId) return null;
  const missing = series.elements.filter(
    (e) => kinds.includes(e.kind) && e.members.length > 0 && !e.members.some((m) => m.story_id === storyId),
  );
  if (missing.length === 0) return null;

  async function add(elementId: string, name: string, kind: SeriesKind) {
    if (!series || !storyId) return;
    setBusy(elementId);
    try {
      const next = await seriesApi.addToBook(series.id, elementId, storyId);
      useSeriesStore.getState().accept(next);
      await refreshBookLists(storyId, kind);
      const mine = next.elements.find((e) => e.id === elementId)?.members.find((m) => m.story_id === storyId);
      toast.success(`${name} is in this book now, carried on from the book before`);
      if (mine) onAdded?.(mine.ref_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.ghosts} aria-label="From the series">
      <p className={styles.ghostsHead}>From the series</p>
      {missing.map((e) => (
        <div key={e.id} className={styles.ghost}>
          <span className={styles.ghostText}>
            <span className={styles.ghostName}>{e.name}</span>
            <span className={styles.ghostSub}>{bookList(e.members.map((m) => m.position))}</span>
          </span>
          <button
            className={styles.textBtn}
            disabled={busy === e.id}
            onClick={() => add(e.id, e.name, e.kind)}
            aria-label={`Add ${e.name} to this book`}
          >
            <Plus size={12} aria-hidden />
            Add
          </button>
        </div>
      ))}
    </div>
  );
}
