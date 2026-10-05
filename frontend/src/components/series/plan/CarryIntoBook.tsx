import { useEffect, useState } from "react";
import { BookCopy } from "lucide-react";
import { seriesApi, type CarryCandidate, type Series, type SeriesBook } from "../../../api/series";
import { carryItem, carryKey } from "../../../lib/series/carry";
import { toast } from "../../../stores/toastStore";
import { Modal } from "../../common";
import CarryOverStep from "../CarryOverStep";
import styles from "./SeriesPlan.module.css";

/**
 * A book already in the series given its cast from the book before it: a planned book made
 * before the one before it had anyone in it. The same choice a sequel makes when it is
 * written, one undo in this book.
 */
export default function CarryIntoBook({
  series,
  book,
  from,
  onSeries,
  onClose,
}: {
  series: Series;
  book: SeriesBook;
  from: SeriesBook;
  onSeries: (s: Series) => void;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<CarryCandidate[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    seriesApi
      .carryOver(from.story_id)
      .then((list) => {
        setCandidates(list);
        setChosen(new Set(list.filter((c) => c.preselect).map(carryKey)));
      })
      .catch(() => setCandidates([]));
  }, [from.story_id]);

  async function bring() {
    if (!candidates) return;
    setBusy(true);
    try {
      const carry = candidates.filter((c) => chosen.has(carryKey(c))).map(carryItem);
      onSeries(await seriesApi.carryInto(series.id, book.story_id, from.story_id, carry));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "They could not be brought in.");
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Into “${book.title}”`}
      icon={<BookCopy size={15} />}
      size="sm"
      footer={
        <>
          <button className={styles.textBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.btn} onClick={bring} disabled={busy || !candidates || chosen.size === 0}>
            Bring them in
          </button>
        </>
      }
    >
      <CarryOverStep
        previousTitle={from.title}
        candidates={candidates}
        chosen={chosen}
        onChange={setChosen}
      />
    </Modal>
  );
}
