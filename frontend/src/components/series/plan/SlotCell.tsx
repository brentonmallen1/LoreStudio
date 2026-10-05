import { useState } from "react";
import { api } from "../../../api/client";
import {
  seriesApi,
  type Series,
  type SeriesAxis,
  type SeriesBook,
  type SlotInput,
} from "../../../api/series";
import { AXIS_SERIES_KIND, slotOf } from "../../../lib/series/plan";
import { toast } from "../../../stores/toastStore";
import styles from "./SeriesPlan.module.css";

interface Row {
  id: string;
  name: string;
}

/** This book's own rows of a kind, for choosing one that is not shared with the series yet. */
async function bookRows(kind: SeriesAxis["kind"], storyId: string): Promise<Row[]> {
  if (kind === "character") return api.listCharacters(storyId);
  if (kind === "era") return api.listEras(storyId);
  if (kind === "location") return api.listLocationsFlat(storyId);
  return [];
}

async function makeRow(kind: SeriesAxis["kind"], storyId: string, name: string): Promise<Row> {
  if (kind === "character") return api.createCharacter(storyId, { name });
  if (kind === "era") return api.createEra(storyId, { name });
  return api.createLocation(storyId, { name });
}

/**
 * One book on one axis: who or what it is, chosen from the series or the book, or an idea in
 * words until it is someone. A linked element the book does not have yet can be brought in;
 * an idea can be made real in the book. Every change is undoable in that book.
 */
export default function SlotCell({
  series,
  book,
  axis,
  onSeries,
}: {
  series: Series;
  book: SeriesBook;
  axis: SeriesAxis;
  onSeries: (s: Series) => void;
}) {
  const current = slotOf(series, book.story_id, axis.id);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [idea, setIdea] = useState("");
  const kind = AXIS_SERIES_KIND[axis.kind];

  const set = (value: SlotInput) =>
    seriesApi
      .updateBook(series.id, book.story_id, { slots: { [axis.id]: value } })
      .then((s) => {
        onSeries(s);
        setEditing(false);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "That could not be saved."));

  function open() {
    setEditing(true);
    setIdea(current && !current.element ? current.name : "");
    if (kind)
      bookRows(axis.kind, book.story_id)
        .then(setRows)
        .catch(() => setRows([]));
  }

  async function make() {
    if (!current?.name) return;
    try {
      const row = await makeRow(axis.kind, book.story_id, current.name);
      await set({ kind: kind!, story_id: book.story_id, ref_id: row.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "It could not be made.");
    }
  }

  if (!editing) {
    return (
      <div className={styles.stack}>
        <button
          className={styles.slotBtn}
          onClick={open}
          aria-label={`${axis.label} of ${book.title}: change`}
        >
          {current?.name ? (
            <>
              {current.name}
              {!current.element && kind && <span className={styles.note}> · an idea</span>}
            </>
          ) : (
            <span className={styles.note}>Not decided</span>
          )}
        </button>
        {current?.element && !current.inBook && (
          <button
            className={styles.textBtn}
            onClick={() =>
              seriesApi
                .addToBook(series.id, current.element!.id, book.story_id)
                .then(onSeries)
                .catch((err) =>
                  toast.error(err instanceof Error ? err.message : "It could not be brought in."),
                )
            }
          >
            Bring {current.name} into this book
          </button>
        )}
        {current && !current.element && kind && current.name && (
          <button className={styles.textBtn} onClick={make}>
            Make {current.name} in this book
          </button>
        )}
      </div>
    );
  }

  const shared = kind ? series.elements.filter((e) => e.kind === kind) : [];
  const sharedRefs = new Set(shared.flatMap((e) => e.members.map((m) => m.ref_id)));
  const own = (rows ?? []).filter((r) => !sharedRefs.has(r.id));
  return (
    <div className={styles.stack}>
      {kind && (
        <select
          className={styles.input}
          aria-label={`${axis.label} of ${book.title}`}
          value=""
          onChange={(e) => {
            const [from, id] = e.target.value.split(":");
            if (from === "el") void set({ element_id: id });
            else if (from === "row") void set({ kind, story_id: book.story_id, ref_id: id });
          }}
        >
          <option value="">Choose…</option>
          {shared.length > 0 && (
            <optgroup label="Shared by the series">
              {shared.map((e) => (
                <option key={e.id} value={`el:${e.id}`}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
          {own.length > 0 && (
            <optgroup label={`In ${book.title}`}>
              {own.map((r) => (
                <option key={r.id} value={`row:${r.id}`}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          void set(idea.trim() ? { text: idea.trim() } : null);
        }}
      >
        <input
          className={styles.input}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={kind ? "Or an idea, in words…" : "In words…"}
          aria-label={`${axis.label} of ${book.title}, in words`}
        />
        <button className={styles.btn} type="submit">
          Keep
        </button>
      </form>
      <div className={styles.addRow}>
        {current && (
          <button className={styles.textBtn} onClick={() => void set(null)}>
            Clear it
          </button>
        )}
        <button className={styles.textBtn} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
