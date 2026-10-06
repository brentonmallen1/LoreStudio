import type { NumbersCompare } from "../../hooks/useNumbersCompare";
import type { Figures } from "../../lib/numbers/figures";
import { readingName, when } from "../../lib/numbers/readings";
import { serverTime } from "../../lib/serverDate";
import type { ReadingSummary } from "../../types/numbers";
import styles from "./Compare.module.css";

interface Metric {
  key: string;
  name: string;
  of: (r: ReadingSummary) => number | null;
  now: (f: Figures) => number | null;
  unit?: string;
}

const METRICS: Metric[] = [
  { key: "words", name: "Words", of: (r) => r.words, now: (f) => f.words.total },
  { key: "scenes", name: "Scenes", of: (r) => r.scenes, now: (f) => f.words.scenes },
  { key: "balance", name: "Dialogue balance", of: (r) => r.balance, now: (f) => f.dialogue.balance },
  {
    key: "passive",
    name: "Passive",
    of: (r) => r.passive_pct,
    now: (f) => f.prose?.passive_pct ?? null,
    unit: "%",
  },
  {
    key: "findings",
    name: "Open findings",
    of: (r) => r.open_findings,
    now: (f) => (f.findings ? Object.values(f.findings).reduce((a, b) => a + b, 0) : null),
  },
];

const W = 132;
const H = 30;
const PAD = 4;

/**
 * The numbers over time (doc 19 P6, D5): a small line for each headline figure across every
 * reading, the book as it is at the end (when it is on the page). One axis each, never two measures on one. A point is
 * a reading: hover names it, choosing it compares with it.
 */
export default function Trend({ compare, now }: { compare: NumbersCompare; now: Figures | null }) {
  const { readings, fromId, toId, choose, clock } = compare;
  // Comparing two readings, the later one stands where the book as it is would.
  const toReading = now ? null : (readings.find((r) => r.id === toId) ?? null);
  if (readings.length < 2) return null;
  // The book as it is ends the line; comparing two readings, the last reading does.
  const end = now ? clock : serverTime(readings[readings.length - 1].taken_at);
  const start = serverTime(readings[0].taken_at);
  const x = (t: number) => PAD + ((t - start) / Math.max(1, end - start)) * (W - 2 * PAD);

  return (
    <section className={styles.trend} aria-label="The numbers over time">
      {METRICS.map((m) => {
        const points = readings
          .map((r) => ({ r, v: m.of(r), t: serverTime(r.taken_at) }))
          .filter((p): p is { r: ReadingSummary; v: number; t: number } => p.v !== null);
        const current = now ? m.now(now) : toReading ? m.of(toReading) : null;
        const values = [...points.map((p) => p.v), ...(current !== null ? [current] : [])];
        if (values.length < 2) return null;
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        const y = (v: number) => H - PAD - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 2 * PAD);
        const line = [
          ...points.map((p) => [x(p.t), y(p.v)]),
          ...(current !== null && !toReading ? [[x(end), y(current)]] : []),
        ]
          .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
          .join(" ");
        const fmt = (v: number) => `${v.toLocaleString()}${m.unit ?? ""}`;
        const from = points.find((p) => p.r.id === fromId);
        return (
          <div key={m.key} className={styles.spark}>
            <span className={styles.sparkName}>{m.name}</span>
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`${m.name}: from ${fmt(points[0]?.v ?? 0)} to ${current !== null ? fmt(current) : fmt(points[points.length - 1].v)}`}
            >
              <path d={line} className={styles.sparkLine} />
              {points.map((p) => (
                <circle
                  key={p.r.id}
                  cx={x(p.t)}
                  cy={y(p.v)}
                  r={p.r.id === fromId ? 3.5 : 2.5}
                  className={styles.sparkPoint}
                  data-from={p.r.id === fromId || undefined}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Compare with ${readingName(p.r)}, ${when(p.r.taken_at)}`}
                  onClick={() => choose(p.r.id)}
                  onKeyDown={(e) => e.key === "Enter" && choose(p.r.id)}
                >
                  <title>{`${readingName(p.r)}, ${when(p.r.taken_at)}: ${fmt(p.v)}`}</title>
                </circle>
              ))}
              {current !== null && (
                <circle
                  cx={x(toReading ? serverTime(toReading.taken_at) : end)}
                  cy={y(current)}
                  r={3}
                  className={styles.sparkNow}
                />
              )}
            </svg>
            <span className={styles.sparkValue}>
              {current !== null ? fmt(current) : "–"}
              {from && current !== null && from.v !== current && (
                <span className={styles.sparkWas}>was {fmt(from.v)}</span>
              )}
            </span>
          </div>
        );
      })}
    </section>
  );
}
