import { useState } from "react";
import { Plus, X } from "lucide-react";
import { seriesApi, type AxisKind, type Series, type SeriesAxis } from "../../../api/series";
import { AXIS_PRESETS as PRESETS } from "../../../lib/series/plan";
import { toast } from "../../../stores/toastStore";
import styles from "./SeriesPlan.module.css";

type Draft = Omit<SeriesAxis, "id"> & { id?: string; key: string };

const KIND_WORDS: Record<AxisKind, string> = {
  character: "A character",
  era: "An era",
  location: "A place",
  custom: "In words",
};

/**
 * What changes from book to book, if anything does: a viewpoint each book is seen through, an
 * era, a place, or something said in words (a season, a generation, a theme). Each is saved
 * as it is named; none is required.
 */
export default function AxesStep({ series, onSeries }: { series: Series; onSeries: (s: Series) => void }) {
  const [axes, setAxes] = useState<Draft[]>(() => (series.axes ?? []).map((a) => ({ ...a, key: a.id })));

  async function save(next: Draft[]) {
    const named = next.filter((a) => a.label.trim());
    try {
      const out = await seriesApi.setAxes(
        series.id,
        named.map(({ id, kind, label, pov }) => ({ id, kind, label: label.trim(), pov: !!pov })),
      );
      onSeries(out);
      let i = 0;
      setAxes(next.map((a) => (a.label.trim() ? { ...out.axes![i++], key: a.key } : a)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That could not be saved.");
    }
  }
  const edit = (key: string, patch: Partial<Draft>) =>
    setAxes((as) => as.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  return (
    <div className={styles.stack}>
      {axes.map((axis) => (
        <div key={axis.key} className={styles.beat}>
          <div className={styles.beatHead}>
            <input
              className={styles.input}
              value={axis.label}
              onChange={(e) => edit(axis.key, { label: e.target.value })}
              onBlur={() => save(axes)}
              placeholder="What it is called: Viewpoint, Era, Season…"
              aria-label="Name of what changes"
            />
            <span className={styles.note}>{KIND_WORDS[axis.kind]}</span>
            <button
              className={styles.iconBtn}
              onClick={() => {
                const next = axes.filter((a) => a.key !== axis.key);
                setAxes(next);
                void save(next);
              }}
              aria-label={`Stop planning by ${axis.label || "this"}`}
            >
              <X size={14} />
            </button>
          </div>
          {axis.kind === "character" && (
            <label className={styles.note}>
              <input
                type="checkbox"
                checked={!!axis.pov}
                onChange={(e) => {
                  const next = axes.map((a) => (a.key === axis.key ? { ...a, pov: e.target.checked } : a));
                  setAxes(next);
                  void save(next);
                }}
              />{" "}
              Each book is seen through this character's eyes: say so when a scene is told by someone else
            </label>
          )}
        </div>
      ))}
      <div className={styles.chips}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={styles.btn}
            onClick={() => {
              const next = [...axes, { ...p.axis, key: crypto.randomUUID() }];
              setAxes(next);
              if (p.axis.label) void save(next);
            }}
          >
            <Plus size={13} aria-hidden />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
