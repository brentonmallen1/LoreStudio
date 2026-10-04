import { useNavigate } from "react-router-dom";
import { BookCopy } from "lucide-react";
import PageHeader from "../../layout/PageHeader";
import Canon from "../../series/Canon";
import SeriesMembership from "../../series/SeriesMembership";
import { bookLabel, useSeriesStore } from "../../../stores/seriesStore";
import styles from "../../series/Series.module.css";

/**
 * Lorebook › Series (series doc): the whole Canon from inside a book, the same list the
 * series' own page shows, saying what is in this book and bringing in what is not. A book
 * of its own sees how to put it in a series.
 */
export default function SeriesSection({ storyId }: { storyId: string }) {
  const series = useSeriesStore((s) => (s.storyId === storyId ? s.series : null));
  const position = useSeriesStore((s) => s.position);
  const accept = useSeriesStore((s) => s.accept);
  const navigate = useNavigate();

  const inThisBook = series
    ? series.elements.filter((e) => e.members.some((m) => m.story_id === storyId))
    : [];
  return (
    <div className={styles.page}>
      <PageHeader
        title="Series"
        summary={
          series && position !== null
            ? `${bookLabel(position)} of ${series.name}: ${inThisBook.length} of ${series.elements.length} shared ${
                series.elements.length === 1 ? "element" : "elements"
              } in this book`
            : "This book stands on its own"
        }
        primary={
          series
            ? { label: "Open the series", icon: BookCopy, onClick: () => navigate(`/series/${series.id}`) }
            : undefined
        }
      />
      <main className={styles.main}>
        <SeriesMembership storyId={storyId} />
        {series && (
          <section className={styles.section} aria-labelledby="series-canon-here">
            <div className={styles.sectionHead}>
              <h2 id="series-canon-here" className={styles.sectionTitle}>
                Canon
              </h2>
              <p className={styles.sectionNote}>
                Bring one into this book and it starts where the book before left it; from then on it changes
                here as you write.
              </p>
            </div>
            <Canon series={series} here={storyId} onSeries={accept} />
          </section>
        )}
      </main>
    </div>
  );
}
