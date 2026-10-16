import { useState } from "react";
import { BookCopy } from "lucide-react";
import { seriesApi } from "../../api/series";
import { useSeriesStore } from "../../stores/seriesStore";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import { Modal } from "../common";
import { booksSentence, deleteLabel } from "./deleteSeries";
import styles from "./DeleteSeriesDialog.module.css";

export type BooksChoice = "keep" | "delete";

/**
 * Deleting a series asks what happens to its books (A3): kept as standalone stories, the
 * default, or deleted with it. The button says which, and only the delete-the-books choice
 * is drawn in the danger colour. Used by the series page's ⋯ and the series' ⋯ on All stories.
 */
export default function DeleteSeriesDialog({
  series,
  words,
  onClose,
  onDeleted,
}: {
  series: { id: string; name: string; books: { story_id: string; title: string }[] };
  /** The books' words together, when known: said beside the choice that deletes them. */
  words?: number;
  onClose: () => void;
  onDeleted: (books: BooksChoice) => void;
}) {
  const [choice, setChoice] = useState<BooksChoice>("keep");
  const [busy, setBusy] = useState(false);
  const count = series.books.length;
  const books = count > 0 ? choice : "keep";

  async function remove() {
    setBusy(true);
    try {
      await seriesApi.remove(series.id, books);
      if (books === "delete") {
        const { removeStory } = useStoryStore.getState();
        for (const b of series.books) removeStory(b.story_id);
      }
      // The open book's copy of its series (the trail, its Lorebook) lets go of it.
      const open = useSeriesStore.getState();
      if (open.series?.id === series.id) open.accept({ ...open.series, books: [] });
      onDeleted(books);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The series could not be deleted.");
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Delete “${series.name}”?`}
      icon={<BookCopy size={15} />}
      size="sm"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.ghost} onClick={onClose}>
            Keep the series
          </button>
          <button
            type="button"
            className={books === "delete" ? styles.danger : styles.primary}
            onClick={() => void remove()}
            disabled={busy}
          >
            {deleteLabel(books, count)}
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        <p className={styles.lead}>{booksSentence(series.books.map((b) => b.title))}</p>
        {count > 0 && (
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>What happens to the {count === 1 ? "book" : "books"}?</legend>
            <label className={`${styles.choice} ${choice === "keep" ? styles.chosen : ""}`}>
              <input
                type="radio"
                name="series-books"
                checked={choice === "keep"}
                onChange={() => setChoice("keep")}
              />
              <span className={styles.text}>
                <span className={styles.name}>
                  Keep {count === 1 ? "it as a standalone story" : "them as standalone stories"}
                </span>
                <span className={styles.hint}>
                  {count === 1 ? "The book keeps" : "Each book keeps"} its own characters, places and prose.
                  Only the grouping and the series plan go.
                </span>
              </span>
            </label>
            <label
              className={`${styles.choice} ${styles.dangerChoice} ${choice === "delete" ? styles.chosen : ""}`}
            >
              <input
                type="radio"
                name="series-books"
                checked={choice === "delete"}
                onChange={() => setChoice("delete")}
              />
              <span className={styles.text}>
                <span className={styles.name}>Delete {count === 1 ? "the book" : "the books"} too</span>
                <span className={styles.hint}>
                  {count === 1 ? "The book" : `All ${count} books`} and everything in{" "}
                  {count === 1 ? "it" : "them"}
                  {words ? `, about ${roundWords(words)} words` : ""}. This can’t be undone; export{" "}
                  {count === 1 ? "it" : "them"} first if you might want {count === 1 ? "it" : "them"} back.
                </span>
              </span>
            </label>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

function roundWords(n: number): string {
  const step = n >= 10000 ? 1000 : n >= 1000 ? 100 : 10;
  return (Math.round(n / step) * step || n).toLocaleString("en-US");
}
