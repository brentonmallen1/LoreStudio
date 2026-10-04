import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookCopy } from "lucide-react";
import { seriesApi, type SeriesSummary } from "../../api/series";
import { bookLabel, useSeriesStore } from "../../stores/seriesStore";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import styles from "./Series.module.css";

/**
 * "Part of a series…" (series doc): which series this book is in and where, or a way to
 * put it in one: an existing series, or a new one starting with it. A book that leaves keeps
 * everything in it as its own.
 */
export default function SeriesMembership({ storyId }: { storyId: string }) {
  const series = useSeriesStore((s) => (s.storyId === storyId ? s.series : null));
  const position = useSeriesStore((s) => s.position);
  const title = useStoryStore((s) => s.activeStory?.title ?? "");
  const [all, setAll] = useState<SeriesSummary[]>([]);
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (series) return;
    seriesApi
      .list()
      .then(setAll)
      .catch(() => {});
  }, [series]);

  async function run(fn: () => Promise<unknown>, failed: string) {
    setBusy(true);
    try {
      await fn();
      await useSeriesStore.getState().load(storyId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed);
    } finally {
      setBusy(false);
    }
  }

  if (series && position !== null)
    return (
      <div className={styles.membership}>
        <BookCopy size={15} aria-hidden className={styles.membershipIcon} />
        <span className={styles.sectionNote}>
          {bookLabel(position)} of <Link to={`/series/${series.id}`}>{series.name}</Link>, a series of{" "}
          {series.books.length} {series.books.length === 1 ? "book" : "books"}.
        </span>
        <button
          className={styles.textBtn}
          disabled={busy}
          title="It keeps its characters, places and world as its own"
          onClick={() => run(() => seriesApi.leave(series.id, storyId), "The book could not be taken out.")}
        >
          Take it out of the series
        </button>
      </div>
    );

  return (
    <div className={styles.membershipForm}>
      <p className={styles.sectionNote}>
        This book stands on its own. If it belongs with other books, put it in a series: they can share
        characters, places and the world, each book starting from where the one before left them.
      </p>
      {all.length > 0 && (
        <div className={styles.membershipRow}>
          <label className={styles.label} htmlFor="join-series">
            Add it to
          </label>
          <select
            id="join-series"
            className={styles.input}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">Choose a series…</option>
            {all.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.books.length} {s.books.length === 1 ? "book" : "books"})
              </option>
            ))}
          </select>
          <button
            className={styles.textBtn}
            disabled={!choice || busy}
            onClick={() => run(() => seriesApi.join(choice, storyId), "The book could not be added.")}
          >
            Add as the last book
          </button>
        </div>
      )}
      <div className={styles.membershipRow}>
        <label className={styles.label} htmlFor="new-series">
          Or start a series called
        </label>
        <input
          id="new-series"
          className={styles.input}
          value={name}
          placeholder={title}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className={styles.textBtn}
          disabled={busy}
          onClick={() =>
            run(
              () => seriesApi.create({ name: name.trim() || title, story_ids: [storyId] }),
              "The series could not be made.",
            )
          }
        >
          Start the series
        </button>
      </div>
    </div>
  );
}
