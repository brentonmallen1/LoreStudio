import { useState } from "react";
import { Plus, Spline, Trash2, X } from "lucide-react";
import { seriesApi, type Series, type SeriesAxis } from "../../../api/series";
import { AXIS_PRESETS as PRESETS } from "../../../lib/series/plan";
import { toast } from "../../../stores/toastStore";
import Modal from "../../common/Modal";
import ArcStep from "./ArcStep";
import styles from "./SeriesPlan.module.css";

/**
 * The Board's row headers, where each row is defined: a row that changes from book to book
 * (a viewpoint, an era) is named, told through someone's eyes or taken away on its header,
 * and added from the bar under the Board. The arc's beats are edited from its header.
 */

type OnSeries = (s: Series) => void;

function saveAxes(series: Series, axes: SeriesAxis[], onSeries: OnSeries) {
  return seriesApi
    .setAxes(
      series.id,
      axes.map(({ id, kind, label, pov }) => ({
        id: id || undefined,
        kind,
        label: label.trim(),
        pov: !!pov,
      })),
    )
    .then(onSeries)
    .catch((err) => toast.error(err instanceof Error ? err.message : "The row could not be saved."));
}

const HINTS: Record<SeriesAxis["kind"], string> = {
  character: "a character for each book",
  era: "an era for each book",
  location: "a place for each book",
  custom: "in words, for each book",
};

/** A row that changes from book to book: its name, what it holds, and taking it away. */
export function AxisHead({
  series,
  axis,
  onSeries,
}: {
  series: Series;
  axis: SeriesAxis;
  onSeries: OnSeries;
}) {
  const [name, setName] = useState(axis.label);
  const [removing, setRemoving] = useState(false);
  const axes = series.axes ?? [];
  const change = (patch: Partial<SeriesAxis>) =>
    saveAxes(
      series,
      axes.map((a) => (a.id === axis.id ? { ...a, ...patch } : a)),
      onSeries,
    );

  return (
    <>
      <div className={styles.rowHeadTop}>
        <input
          className={styles.rowName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() && name !== axis.label ? change({ label: name }) : setName(axis.label))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setName(axis.label);
          }}
          aria-label={`Name of the ${axis.label} row`}
          title="Rename this row"
        />
        <button
          className={styles.iconBtn}
          onClick={() => setRemoving(true)}
          aria-label={`Remove the ${axis.label} row`}
          title="Remove this row"
        >
          <X size={14} />
        </button>
      </div>
      <span className={styles.rowHint}>{HINTS[axis.kind]}</span>
      {axis.kind === "character" && (
        <label className={styles.rowHint}>
          <input type="checkbox" checked={!!axis.pov} onChange={(e) => change({ pov: e.target.checked })} />{" "}
          Seen through their eyes
        </label>
      )}
      <Modal
        isOpen={removing}
        onClose={() => setRemoving(false)}
        title={`Remove the ${axis.label} row?`}
        icon={<Trash2 size={15} />}
        size="sm"
        footer={
          <>
            <button className={styles.textBtn} onClick={() => setRemoving(false)}>
              Keep it
            </button>
            <button
              className={styles.btn}
              onClick={() => {
                setRemoving(false);
                void saveAxes(
                  series,
                  axes.filter((a) => a.id !== axis.id),
                  onSeries,
                );
              }}
            >
              Remove the row
            </button>
          </>
        }
      >
        <p className={styles.note}>
          Each book's {axis.label.toLowerCase()} on the plan goes with it, and the series' own shape is not
          undone. The books, and everyone and everything in them, stay as they are.
        </p>
      </Modal>
    </>
  );
}

/** "Add a row": the things a series most often changes by, or one named here. */
export function AddRowBar({ series, onSeries }: { series: Series; onSeries: OnSeries }) {
  const [naming, setNaming] = useState<string | null>(null);
  const axes = series.axes ?? [];
  const has = (a: Omit<SeriesAxis, "id">) =>
    axes.some((b) => b.kind === a.kind && b.label.toLowerCase() === a.label.toLowerCase());
  const add = (axis: Omit<SeriesAxis, "id">) =>
    saveAxes(series, [...axes, { ...axis, id: "" }], onSeries).then(() => setNaming(null));

  return (
    <div className={styles.rowBar} role="group" aria-label="Add a row that changes from book to book">
      <span className={styles.rowHint}>Add a row:</span>
      {PRESETS.filter((p) => p.axis.label).map((p) => (
        <button
          key={p.label}
          className={styles.btn}
          disabled={has(p.axis)}
          title={has(p.axis) ? "Already a row" : p.label}
          onClick={() => void add(p.axis)}
        >
          <Plus size={13} aria-hidden />
          {p.axis.label}
        </button>
      ))}
      {naming === null ? (
        <button className={styles.btn} onClick={() => setNaming("")}>
          <Plus size={13} aria-hidden />
          Something else
        </button>
      ) : (
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (naming.trim()) void add({ kind: "custom", label: naming.trim() });
          }}
        >
          <input
            className={styles.input}
            autoFocus
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setNaming(null)}
            placeholder="Season, generation, theme…"
            aria-label="Name of the new row"
          />
          <button className={styles.btn} type="submit" disabled={!naming.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}

/** The arc's beats, edited in full: named, ordered, described and placed on books. */
export function ArcModal({
  open,
  onClose,
  series,
  onSeries,
}: {
  open: boolean;
  onClose: () => void;
  series: Series;
  onSeries: OnSeries;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Series arc"
      icon={<Spline size={15} />}
      size="lg"
      footer={
        <button className={styles.btn} onClick={onClose}>
          Done
        </button>
      }
    >
      <p className={styles.note}>
        The series' own turning points, in order, each placed on the books that carry it. A beat can span
        books.
      </p>
      {open && <ArcStep series={series} onSeries={onSeries} />}
    </Modal>
  );
}
