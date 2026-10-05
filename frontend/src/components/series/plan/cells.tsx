import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { seriesApi, type Series, type SeriesBook } from "../../../api/series";
import { useAutosaveField } from "../../plan/useAutosaveField";
import { toast } from "../../../stores/toastStore";
import styles from "./SeriesPlan.module.css";

/**
 * The pieces of a series' plan that the guided steps and the Board share: a book's part,
 * the arc beats it carries, and a new planned book. Each saves as it goes; a book's own
 * part is undoable in that book.
 */

const failed = (err: unknown, what: string) =>
  toast.error(err instanceof Error ? err.message : `${what} could not be saved.`);

/** A book's part in the series, in the author's words. Key it by the book. */
export function RoleField({
  series,
  book,
  onSeries,
  rows = 2,
}: {
  series: Series;
  book: SeriesBook;
  onSeries: (s: Series) => void;
  rows?: number;
}) {
  const { value, change, flush } = useAutosaveField(book.role ?? "", (role) =>
    seriesApi
      .updateBook(series.id, book.story_id, { role })
      .then(onSeries)
      .catch((err) => failed(err, "The book's part")),
  );
  return (
    <textarea
      className={styles.textarea}
      aria-label={`What ${book.title} does in the series`}
      value={value}
      onChange={(e) => change(e.target.value)}
      onBlur={flush}
      rows={rows}
      placeholder="What this book does that the others don't…"
    />
  );
}

/** The arc's beats as chips on one book: a chip on is a beat this book carries. */
export function BeatChips({
  series,
  book,
  onSeries,
}: {
  series: Series;
  book: SeriesBook;
  onSeries: (s: Series) => void;
}) {
  const arc = series.arc ?? [];
  if (arc.length === 0) return <p className={styles.note}>No arc yet.</p>;
  const carried = new Set(book.arc_beats ?? []);
  function toggle(id: string) {
    const next = carried.has(id) ? [...carried].filter((b) => b !== id) : [...carried, id];
    seriesApi
      .updateBook(series.id, book.story_id, {
        arc_beats: arc.map((b) => b.id).filter((b) => next.includes(b)),
      })
      .then(onSeries)
      .catch((err) => failed(err, "The arc"));
  }
  return (
    <div className={styles.chips} role="group" aria-label={`Arc beats ${book.title} carries`}>
      {arc.map((beat) => (
        <button
          key={beat.id}
          type="button"
          className={`${styles.chip} ${carried.has(beat.id) ? styles.chipOn : ""}`}
          aria-pressed={carried.has(beat.id)}
          title={beat.description || beat.name}
          onClick={() => toggle(beat.id)}
        >
          {beat.name}
        </button>
      ))}
    </div>
  );
}

/** A book planned before it is written, added at the end. */
export function AddBookForm({ series, onSeries }: { series: Series; onSeries: (s: Series) => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const out = await seriesApi.addBook(series.id, { title: title.trim() });
      onSeries(out.series);
      setTitle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The book could not be added.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={styles.addRow} onSubmit={submit}>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Book ${series.books.length + 1}: a working title`}
        aria-label="Title of a planned book"
      />
      <button className={styles.btn} type="submit" disabled={busy || !title.trim()}>
        <Plus size={13} aria-hidden />
        Add a planned book
      </button>
    </form>
  );
}
