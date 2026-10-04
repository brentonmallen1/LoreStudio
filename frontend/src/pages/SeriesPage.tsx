import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookCopy, Plus, Trash2 } from "lucide-react";
import { progressApi, type StoryProgress } from "../api/progress";
import { seriesApi, type Series, type SeriesFinding } from "../api/series";
import PageHeader from "../components/layout/PageHeader";
import { Modal } from "../components/common";
import BooksList from "../components/series/BooksList";
import Canon from "../components/series/Canon";
import CreateStoryDialog from "../components/story/CreateStoryDialog";
import { sheetPath } from "../lib/series/kinds";
import { bookLabel, useSeriesStore } from "../stores/seriesStore";
import { toast } from "../stores/toastStore";
import styles from "../components/series/Series.module.css";

/**
 * A series (series doc): what it is, its books in order, and the Canon, every character,
 * place and part of the world it shares, with how each changes from book to book.
 */
export default function SeriesPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series | null>(null);
  const [progress, setProgress] = useState<Record<string, StoryProgress>>({});
  // "New book in this series" from the palette arrives as ?new=1.
  const [newBook, setNewBook] = useState(() => new URLSearchParams(window.location.search).has("new"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [findings, setFindings] = useState<SeriesFinding[]>([]);
  // "Compare" on a disagreement: which element the Canon opens, and a count to remount it by.
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  // Every change made on this page can settle or raise a disagreement: read them again after each.
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!seriesId) return;
    seriesApi
      .findings(seriesId)
      .then(setFindings)
      .catch(() => {});
  }, [seriesId, rev]);

  const load = useCallback(() => {
    if (!seriesId) return Promise.resolve();
    return seriesApi
      .get(seriesId)
      .then(setSeries)
      .catch(() => {
        toast.error("That series could not be found.");
        navigate("/");
      });
  }, [seriesId, navigate]);

  useEffect(() => {
    if (!seriesId) return;
    seriesApi
      .get(seriesId)
      .then(setSeries)
      .catch(() => {
        toast.error("That series could not be found.");
        navigate("/");
      });
    progressApi
      .list()
      .then((rows) => setProgress(Object.fromEntries(rows.map((r) => [r.story_id, r]))))
      .catch(() => {});
  }, [seriesId, navigate]);

  // The open book's copy (the header's trail, its Lorebook) follows any change made here.
  const accept = useCallback((s: Series) => {
    setSeries(s);
    setRev((r) => r + 1);
    if (s.books.some((b) => b.story_id === useSeriesStore.getState().storyId))
      useSeriesStore.getState().accept(s);
  }, []);

  async function run(fn: () => Promise<Series | void>, failed: string) {
    try {
      const out = await fn();
      if (out) accept(out);
      else await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed);
    }
  }

  if (!series) return <div className={styles.page} />;

  const last = series.books[series.books.length - 1];
  const shared = series.elements.length;
  return (
    <div className={styles.page}>
      <PageHeader
        title={series.name}
        summary={`A series of ${series.books.length} ${series.books.length === 1 ? "book" : "books"}, ${
          shared === 0 ? "nothing shared yet" : `${shared} shared ${shared === 1 ? "element" : "elements"}`
        }`}
        primary={{ label: "New book", icon: Plus, onClick: () => setNewBook(true) }}
        more={[
          { label: "Delete the series…", icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
        ]}
      />
      <main className={styles.main}>
        <SeriesIdentity
          key={`${series.id}|${series.name}|${series.premise}|${series.intent}`}
          series={series}
          onSaved={accept}
        />

        <section className={styles.section} aria-labelledby="series-books">
          <div className={styles.sectionHead}>
            <h2 id="series-books" className={styles.sectionTitle}>
              Books
            </h2>
            <p className={styles.sectionNote}>In reading order: each book starts from the one before it.</p>
          </div>
          <BooksList
            series={series}
            progress={progress}
            onReorder={(ids) => run(() => seriesApi.reorder(series.id, ids), "The books could not be moved.")}
            onLeave={(storyId) =>
              run(async () => {
                await seriesApi.leave(series.id, storyId);
                if (series.books.length === 1) navigate("/");
              }, "The book could not be taken out.")
            }
          />
        </section>

        {findings.length > 0 && (
          <section className={styles.section} aria-labelledby="series-eye">
            <div className={styles.sectionHead}>
              <h2 id="series-eye" className={styles.sectionTitle}>
                Needs your eye
              </h2>
              <p className={styles.sectionNote}>
                Where the books disagree about what should stay true, and threads across them left open,
                opened twice or crossing. Dismissing one in any book dismisses it in all.
              </p>
            </div>
            <ul className={styles.eyeList}>
              {findings.map((f) => (
                <li key={f.id} className={styles.eyeRow}>
                  <span className={styles.eyeText}>
                    {f.text}
                    {f.suggestion && <span className={styles.eyeEvidence}>{f.suggestion}</span>}
                  </span>
                  {f.check === "series-canon" && f.element_id ? (
                    <button
                      className={styles.textBtn}
                      onClick={() => setFocus({ id: f.element_id as string, n: (focus?.n ?? 0) + 1 })}
                    >
                      Compare the books
                    </button>
                  ) : (
                    f.ref_id && (
                      <Link
                        className={styles.textBtn}
                        to={sheetPath(f.story_ids[0], "plot_thread", f.ref_id)}
                      >
                        Open in{" "}
                        {bookLabel(series.books.find((b) => b.story_id === f.story_ids[0])?.position ?? 0)}
                      </Link>
                    )
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="series-canon">
          <div className={styles.sectionHead}>
            <h2 id="series-canon" className={styles.sectionTitle}>
              Canon
            </h2>
            <p className={styles.sectionNote}>
              What the books share. Open one to see what stays true and how it changes from book to book.
            </p>
          </div>
          <Canon key={focus?.n ?? 0} series={series} onSeries={accept} focus={focus?.id} />
        </section>
      </main>

      {newBook && last && <CreateStoryDialog sequelTo={last.story_id} onClose={() => setNewBook(false)} />}
      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${series.name}”?`}
        icon={<BookCopy size={15} />}
        size="sm"
        footer={
          <>
            <button className={styles.textBtn} onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button
              className={styles.textBtn}
              onClick={() =>
                run(async () => {
                  await seriesApi.remove(series.id);
                  useSeriesStore.getState().accept({ ...series, books: [] });
                  navigate("/");
                }, "The series could not be deleted.")
              }
            >
              Delete the series
            </button>
          </>
        }
      >
        <p className={styles.sectionNote}>
          Every book stays, with all its characters, places and world as its own. Only the series goes: its
          order, and which things in different books are the same.
        </p>
      </Modal>
    </div>
  );
}

/** The series' own name, premise and intent, saved as each field is left (keyed: a saved
 * change remounts it with the new values). */
function SeriesIdentity({ series, onSaved }: { series: Series; onSaved: (s: Series) => void }) {
  const [draft, setDraft] = useState({ name: series.name, premise: series.premise, intent: series.intent });

  async function save(key: keyof typeof draft) {
    const value = draft[key];
    if (value === series[key] || (key === "name" && !value.trim())) {
      setDraft((d) => ({ ...d, [key]: series[key] }));
      return;
    }
    try {
      onSaved(await seriesApi.update(series.id, { [key]: value }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That could not be saved.");
    }
  }

  return (
    <section className={styles.identity} aria-label="About the series">
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => save("name")}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Premise: what the books are about, together</span>
        <textarea
          className={styles.textarea}
          value={draft.premise}
          onChange={(e) => setDraft({ ...draft, premise: e.target.value })}
          onBlur={() => save("premise")}
          placeholder="A lighthouse, and the three generations who keep it…"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Intent: what the series is for</span>
        <textarea
          className={styles.textarea}
          value={draft.intent}
          onChange={(e) => setDraft({ ...draft, intent: e.target.value })}
          onBlur={() => save("intent")}
          placeholder="Where it is going across the books, and why it needs more than one…"
        />
      </label>
    </section>
  );
}
