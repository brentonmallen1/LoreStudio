import { useState } from "react";
import { Link } from "react-router-dom";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { seriesPath } from "../../../lib/series/sections";
import { beatsOf } from "../../../lib/series/plan";
import { bookLabel, useSeriesStore } from "../../../stores/seriesStore";
import seriesStyles from "../Series.module.css";
import { RoleField } from "./cells";
import styles from "./SeriesPlan.module.css";

/**
 * This book's part of its series' plan, from inside the book (series v2): which book it is,
 * what it does in the series (written here or on the series' Plan, one value either way),
 * and the arc beats it carries. Undo in this book takes back an edit to its part.
 */
export default function ThisBookCard({ storyId }: { storyId: string }) {
  const series = useSeriesStore((s) => (s.storyId === storyId ? s.series : null));
  const accept = useSeriesStore((s) => s.accept);
  // An undo puts the part back: read it again, then start the field from it.
  const [gen, setGen] = useState(0);
  useReloadOnUndo(["series_story"], () =>
    useSeriesStore
      .getState()
      .refetch()
      .then(() => setGen((g) => g + 1)),
  );
  const book = series?.books.find((b) => b.story_id === storyId);
  if (!series || !book) return null;
  const beats = beatsOf(series, storyId);

  return (
    <section className={seriesStyles.section} aria-labelledby="this-book-in-series">
      <div className={seriesStyles.sectionHead}>
        <h2 id="this-book-in-series" className={seriesStyles.sectionTitle}>
          This book in the series
        </h2>
        <p className={seriesStyles.sectionNote}>
          {bookLabel(book.position)} of {series.books.length} in{" "}
          <Link to={seriesPath(series.id, "plan")}>{series.name}</Link>.
        </p>
      </div>
      <RoleField key={`${book.story_id}|${gen}`} series={series} book={book} onSeries={accept} rows={2} />
      {beats.length > 0 && (
        <p className={styles.note}>
          It carries the series' {beats.length === 1 ? "beat" : "beats"}:{" "}
          {beats.map((b) => b.name).join(" · ")}.
        </p>
      )}
    </section>
  );
}
