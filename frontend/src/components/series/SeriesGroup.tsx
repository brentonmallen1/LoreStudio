import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, BookCopy, Plus } from "lucide-react";
import type { SeriesSummary } from "../../api/series";
import styles from "./SeriesGroup.module.css";

const FOLDED_KEY = "ls_folded_series";

function readFolded(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeFolded(ids: string[]) {
  try {
    localStorage.setItem(FOLDED_KEY, JSON.stringify(ids));
  } catch {
    // Folding is a convenience; without storage it is forgotten on reload.
  }
}

/**
 * One series on the dashboard (series doc): its name, which opens the series, how many
 * books, the way to the next one, and its books in order. Folds away, and stays folded.
 */
export default function SeriesGroup({
  series,
  onNewBook,
  children,
}: {
  series: SeriesSummary;
  onNewBook: () => void;
  children: ReactNode;
}) {
  const [folded, setFolded] = useState(() => readFolded().includes(series.id));
  const count = series.books.length;

  function toggle() {
    const next = !folded;
    setFolded(next);
    const ids = readFolded().filter((id) => id !== series.id);
    writeFolded(next ? [...ids, series.id] : ids);
  }

  return (
    <section className={styles.group} aria-label={`Series: ${series.name}`}>
      <header className={styles.head}>
        <button
          className={styles.fold}
          onClick={toggle}
          aria-expanded={!folded}
          aria-label={folded ? `Show the books of ${series.name}` : `Fold ${series.name} away`}
        >
          {folded ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <BookCopy size={15} className={styles.icon} aria-hidden />
        <Link to={`/series/${series.id}`} className={styles.name}>
          {series.name}
        </Link>
        <span className={styles.count}>
          {count} {count === 1 ? "book" : "books"}
        </span>
        <button className={styles.newBook} onClick={onNewBook}>
          <Plus size={13} aria-hidden />
          New book
        </button>
      </header>
      {!folded && children}
    </section>
  );
}
