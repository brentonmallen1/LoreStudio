import { Link } from "react-router-dom";
import { BookCopy } from "lucide-react";
import { seriesPath } from "../../../lib/series/sections";
import { bookLabel, useSeriesStore } from "../../../stores/seriesStore";
import styles from "./SeriesPlan.module.css";

/** One line on a book's Plan: which book of which series it is, and its part there. */
export default function BookInSeriesLine({ storyId }: { storyId: string }) {
  const series = useSeriesStore((s) => (s.storyId === storyId ? s.series : null));
  const book = series?.books.find((b) => b.story_id === storyId);
  if (!series || !book) return null;
  return (
    <p className={styles.seriesLine}>
      <BookCopy size={13} aria-hidden />
      <span>
        {bookLabel(book.position)} of <Link to={seriesPath(series.id, "plan")}>{series.name}</Link>
        {book.role?.trim() ? `: ${book.role.trim()}` : ": its part in the series is not written yet."}
      </span>
    </p>
  );
}
