import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookCopy, Plus, Trash2 } from "lucide-react";
import { progressApi, type StoryProgress } from "../api/progress";
import { seriesApi, type Series, type SeriesFinding } from "../api/series";
import PageHeader from "../components/layout/PageHeader";
import { Modal } from "../components/common";
import BooksList from "../components/series/BooksList";
import Canon from "../components/series/Canon";
import SeriesEye from "../components/series/SeriesEye";
import SeriesIdentity from "../components/series/SeriesIdentity";
import SeriesTapestry from "../components/series/SeriesTapestry";
import SeriesPlan from "../components/series/plan/SeriesPlan";
import SharedResearch from "../components/series/SharedResearch";
import StorySoFar from "../components/series/StorySoFar";
import CreateStoryDialog from "../components/story/CreateStoryDialog";
import { SERIES_SECTIONS, seriesPath, seriesSection } from "../lib/series/sections";
import { useSeriesStore } from "../stores/seriesStore";
import { toast } from "../stores/toastStore";
import styles from "../components/series/Series.module.css";

/**
 * A series (series doc), in sections: the overview (what it is, its books in order, what needs
 * the author's eye), the Canon (every character, place and part of the world it shares, and
 * how each changes from book to book), its Promises (every thread and twist across the books,
 * a column per book, and setups that pay off in another book) and The story so far (what each
 * book leaves the reader with).
 */
export default function SeriesPage() {
  const { seriesId, section: sectionParam } = useParams<{ seriesId: string; section?: string }>();
  const section = seriesSection(sectionParam);
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
  // The books in order, on the Overview and in the Plan's Books step alike.
  const books = (
    <BooksList
      series={series}
      progress={progress}
      onReorder={(ids) => run(() => seriesApi.reorder(series.id, ids), "The books could not be moved.")}
      onLeave={(storyId) =>
        run(async () => {
          await seriesApi.leave(series.id, storyId);
          // A series with a plan of its own waits for its next book; one that only grouped books goes.
          if (series.books.length > 1) return;
          try {
            return await seriesApi.get(series.id);
          } catch {
            navigate("/");
            return { ...series, books: [] };
          }
        }, "The book could not be taken out.")
      }
    />
  );
  const shared = series.elements.length;
  return (
    <div className={styles.page}>
      <PageHeader
        title={series.name}
        summary={`${series.books.length === 0 ? "A series with no books yet" : `A series of ${series.books.length} ${series.books.length === 1 ? "book" : "books"}`}, ${
          shared === 0 ? "nothing shared yet" : `${shared} shared ${shared === 1 ? "element" : "elements"}`
        }`}
        views={[...SERIES_SECTIONS]}
        view={section}
        onView={(v) => navigate(seriesPath(series.id, seriesSection(v)))}
        primary={
          last
            ? { label: "New book", icon: Plus, onClick: () => setNewBook(true) }
            : { label: "Plan a book", icon: Plus, onClick: () => navigate(seriesPath(series.id, "plan")) }
        }
        more={[
          { label: "Delete the series…", icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
        ]}
      />
      <main className={styles.main}>
        {section === "overview" && (
          <>
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
                <p className={styles.sectionNote}>
                  In reading order: each book starts from the one before it.
                </p>
              </div>
              {series.books.length ? (
                books
              ) : (
                <p className={styles.quiet}>No books yet: plan them in the Plan.</p>
              )}
            </section>

            <SeriesEye
              series={series}
              findings={findings}
              onCompare={(id) => {
                setFocus({ id, n: (focus?.n ?? 0) + 1 });
                navigate(seriesPath(series.id, "canon"));
              }}
            />
          </>
        )}

        {section === "plan" && (
          <section className={styles.section} aria-labelledby="series-plan">
            <div className={styles.sectionHead}>
              <h2 id="series-plan" className={styles.sectionTitle}>
                Plan
              </h2>
              <p className={styles.sectionNote}>
                The books, what each one does and the arc across them. All of it optional: plan as much as
                helps, and change it as the books find their own way.
              </p>
            </div>
            <SeriesPlan series={series} progress={progress} onSeries={accept} books={books} />
          </section>
        )}

        {section === "canon" && (
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
        )}

        {section === "promises" && (
          <section className={styles.section} aria-labelledby="series-promises">
            <div className={styles.sectionHead}>
              <h2 id="series-promises" className={styles.sectionTitle}>
                Promises across the books
              </h2>
              <p className={styles.sectionNote}>
                Every thread and twist the books share, and what each book does with it. Open a cell for its
                sheet in that book.
              </p>
            </div>
            <SeriesTapestry series={series} />
          </section>
        )}

        {section === "story-so-far" && (
          <section className={styles.section} aria-labelledby="series-so-far">
            <div className={styles.sectionHead}>
              <h2 id="series-so-far" className={styles.sectionTitle}>
                The story so far
              </h2>
              <p className={styles.sectionNote}>
                What each book leaves the reader with: a reminder before you write the next.
              </p>
            </div>
            <StorySoFar series={series} />
          </section>
        )}

        {section === "research" && (
          <section className={styles.section} aria-labelledby="series-research">
            <div className={styles.sectionHead}>
              <h2 id="series-research" className={styles.sectionTitle}>
                Shared research
              </h2>
              <p className={styles.sectionNote}>
                Research, images and diagrams every book has: an edit in one book is an edit in all of them.
              </p>
            </div>
            <SharedResearch series={series} onSeries={accept} />
          </section>
        )}
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
