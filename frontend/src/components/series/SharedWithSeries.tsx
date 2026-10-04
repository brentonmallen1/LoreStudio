import { useState } from "react";
import { BookCopy, Unlink } from "lucide-react";
import { seriesApi, type Series, type SharedKind } from "../../api/series";
import { bookList, elementForRow, useSeriesStore } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import styles from "./Series.module.css";

/**
 * Research shared with the series (v1.5), on a research entry, an image or a diagram in a
 * book of a series: share it, so every book has it and an edit to any copy is every book's;
 * or, once shared, keep this book's copy apart, or stop sharing it (every book keeps its own).
 * Nothing outside a series.
 */
export default function SharedWithSeries({
  kind,
  refId,
  name,
  onChanged,
}: {
  kind: SharedKind;
  refId: string;
  name: string;
  /** After the series changed here: the view reads its rows again. */
  onChanged?: () => void;
}) {
  const storyId = useSeriesStore((s) => s.storyId);
  const series = useSeriesStore((s) => s.series);
  const [busy, setBusy] = useState(false);
  if (!series || !storyId) return null;
  const element = elementForRow(series, storyId, refId);

  async function run(fn: () => Promise<Series | void>, done: string) {
    setBusy(true);
    try {
      const next = await fn();
      if (next) useSeriesStore.getState().accept(next);
      else await useSeriesStore.getState().refetch();
      onChanged?.();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (!element)
    return (
      <div className={styles.provenanceRow}>
        <button
          type="button"
          className={styles.textBtn}
          disabled={busy}
          onClick={() =>
            void run(
              () => seriesApi.share(series.id, kind, storyId, refId),
              `${name} is in every book of ${series.name} now, kept in step`,
            )
          }
        >
          <BookCopy size={13} aria-hidden /> Share with the series
        </button>
      </div>
    );

  const positions = element.members.map((m) => m.position);
  return (
    <div className={styles.provenanceRow}>
      <BookCopy size={13} aria-hidden className={styles.membershipIcon} />
      <span>
        Shared with {series.name}, in {bookList(positions)}: an edit here is every book's.
      </span>
      {element.members.length > 1 && (
        <button
          type="button"
          className={styles.textBtn}
          disabled={busy}
          onClick={() =>
            void run(
              () => seriesApi.removeFromBook(series.id, element.id, storyId),
              `This book's ${name} is its own now; the other books keep theirs in step`,
            )
          }
        >
          <Unlink size={12} aria-hidden /> Keep this book's apart
        </button>
      )}
      <button
        type="button"
        className={styles.textBtn}
        disabled={busy}
        onClick={() =>
          void run(
            () => seriesApi.unlift(series.id, element.id),
            `${name} is no longer shared: every book keeps its own copy`,
          )
        }
      >
        Stop sharing
      </button>
    </div>
  );
}
