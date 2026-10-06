import { useEffect, useRef, useState } from "react";
import type { NumbersCompare } from "../../hooks/useNumbersCompare";
import { signed } from "../../lib/numbers/compare";
import type { Figures } from "../../lib/numbers/figures";
import { readingName, when } from "../../lib/numbers/readings";
import { useFoldOpen } from "../../lib/panel/fold";
import { anchor, labelRows, strips, timeX, valueY } from "../../lib/numbers/trend";
import { parseServerDate, serverTime } from "../../lib/serverDate";
import type { ReadingSummary } from "../../types/numbers";
import SectionHeading from "./SectionHeading";
import numbers from "./Numbers.module.css";
import styles from "./Compare.module.css";

interface Metric {
  key: string;
  name: string;
  of: (r: ReadingSummary) => number | null;
  now: (f: Figures) => number | null;
  unit?: string;
  digits?: number;
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
    digits: 1,
  },
  {
    key: "findings",
    name: "Open findings",
    of: (r) => r.open_findings,
    now: (f) => (f.findings ? Object.values(f.findings).reduce((a, b) => a + b, 0) : null),
  },
];

const day = (iso: string) =>
  parseServerDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const pos = (x: number, y?: number) =>
  ({ "--x": `${x}%`, ...(y !== undefined && { "--y": `${y}%` }) }) as React.CSSProperties;

type Mark = { r: ReadingSummary; x: number; kind: "version" | "from" | "to" };

/**
 * Over time (doc 19 P6, D5): a line for each headline figure across every reading, on one
 * time axis, the book as it is at the end. Each line has its own scale, never two measures on
 * one. Versions are dashed rules, the reading compared with a solid one. Pointing at a reading
 * reads every figure there; choosing it compares the page with it.
 */
export default function Trend({ compare, now }: { compare: NumbersCompare; now: Figures | null }) {
  const { readings, fromId, toId, choose, clock } = compare;
  const [hover, setHover] = useState<number | "now" | null>(null);
  // Shut until the author opens it; then it stays as they left it.
  const [open, setOpen] = useFoldOpen("numbers-over-time", false);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState(600);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const seen = new ResizeObserver(([entry]) => setPlot(entry.contentRect.width));
    seen.observe(el);
    return () => seen.disconnect();
  }, [readings.length, open]);
  if (readings.length < 2) return null;

  // Comparing two readings, the later one stands where the book as it is would.
  const toReading = now ? null : (readings.find((r) => r.id === toId) ?? null);
  const start = serverTime(readings[0].taken_at);
  const end = now ? clock : serverTime(readings[readings.length - 1].taken_at);
  const xs = readings.map((r) => timeX(serverTime(r.taken_at), start, end));
  const fromIndex = readings.findIndex((r) => r.id === fromId);
  const currentX = toReading ? xs[readings.indexOf(toReading)] : 100;
  const hits = strips(xs, now ? (xs[xs.length - 1] + 100) / 2 : 100);

  const marks: Mark[] = readings.flatMap((r, i): Mark[] => {
    if (i === fromIndex) return [{ r, x: xs[i], kind: "from" }];
    if (r === toReading) return [{ r, x: xs[i], kind: "to" }];
    return r.label ? [{ r, x: xs[i], kind: "version" }] : [];
  });
  // A name's width, near enough: a character of the small type is about 6.5px, capped as the CSS caps it.
  const nameWidth = (m: Mark) =>
    Math.min(192, (m.r.label ?? readingName(m.r)).length * (m.kind === "version" ? 6.3 : 6.9));
  const rows = labelRows(
    marks.map((m) => ({ x: m.x, w: nameWidth(m) })),
    plot,
  );
  const markRows = Math.max(1, ...rows.map((n) => n + 1));
  const hoverX = hover === "now" ? 100 : hover !== null ? xs[hover] : null;
  const hoverAt = hover === "now" ? null : hover !== null ? readings[hover] : null;

  const pick = (r: ReadingSummary) => choose(r.id, toId && toId !== r.id ? toId : null);
  const fmt = (m: Metric, v: number) =>
    `${m.digits ? v.toFixed(m.digits) : v.toLocaleString()}${m.unit ?? ""}`;
  const figures = (r: ReadingSummary) =>
    METRICS.map((m) => {
      const v = m.of(r);
      return v === null ? null : `${m.name} ${fmt(m, v)}`;
    })
      .filter(Boolean)
      .join(", ");

  return (
    <section className={numbers.section} aria-labelledby="numbers-time">
      <SectionHeading
        section="time"
        title="Over time"
        fold={{ open, toggle: () => setOpen(!open) }}
        note={open ? undefined : `${readings.length} readings since ${day(readings[0].taken_at)}`}
      />
      {open && (
        <div id="numbers-time-body">
          <p className={numbers.lede}>
            Five of the page's figures at each of its {readings.length} readings, from{" "}
            {day(readings[0].taken_at)} to {now ? "now" : day(readings[readings.length - 1].taken_at)}. Point
            at the lines to read one reading; choose it to compare the page with it.
          </p>
          <div
            className={styles.time}
            style={{ "--metrics": METRICS.length, "--mark-rows": markRows } as React.CSSProperties}
            onMouseLeave={() => setHover(null)}
          >
            <div ref={plotRef} className={styles.timeMarks} aria-hidden>
              {marks.map((m, i) => (
                <span
                  key={m.r.id}
                  className={styles.markName}
                  data-kind={m.kind}
                  data-anchor={anchor(m.x)}
                  style={{ ...pos(m.x), "--row": rows[i] } as React.CSSProperties}
                >
                  {m.r.label ?? readingName(m.r)}
                </span>
              ))}
            </div>

            {METRICS.map((m, row) => {
              const points = readings
                .map((r, i) => ({ i, v: m.of(r) }))
                .filter((p): p is { i: number; v: number } => p.v !== null);
              const current = now ? m.now(now) : toReading ? m.of(toReading) : null;
              const values = [...points.map((p) => p.v), ...(current !== null ? [current] : [])];
              const lo = Math.min(...values);
              const hi = Math.max(...values);
              const y = (v: number) => valueY(v, lo, hi);
              const line = [
                ...points.map((p) => [xs[p.i], y(p.v)]),
                ...(now && current !== null ? [[100, y(current)]] : []),
              ]
                .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`)
                .join(" ");
              const was = fromIndex >= 0 ? m.of(readings[fromIndex]) : null;
              const first = points[0];
              const atHover = hover === "now" ? current : hover !== null ? m.of(readings[hover]) : null;
              const change = (base: number) => (current !== null ? signed(current - base, m.digits) : "");
              return (
                <div
                  key={m.key}
                  className={styles.timeRow}
                  style={{ "--row": row + 2 } as React.CSSProperties}
                >
                  <span className={styles.timeName}>{m.name}</span>
                  <div className={styles.timePlot}>
                    {values.length === 0 ? (
                      <span className={styles.timeNone}>Not measured at any reading yet</span>
                    ) : (
                      <>
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                          <path d={line} className={styles.timeLine} />
                        </svg>
                        {was !== null && <i className={styles.dotFrom} style={pos(xs[fromIndex], y(was))} />}
                        {current !== null && (
                          <i className={styles.dotNow} style={pos(currentX, y(current))} />
                        )}
                        {atHover !== null && hoverX !== null && (
                          <>
                            <i className={styles.dotHover} style={pos(hoverX, y(atHover))} />
                            <span
                              className={styles.hoverValue}
                              data-left={hoverX > 70 || undefined}
                              style={pos(hoverX, y(atHover))}
                            >
                              {fmt(m, atHover)}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <span className={styles.timeValue}>
                    {current !== null ? fmt(m, current) : "–"}
                    <span className={styles.timeChange}>
                      {current === null
                        ? ""
                        : was !== null
                          ? was === current
                            ? "same as then"
                            : `was ${fmt(m, was)}`
                          : first && first.i !== readings.length - 1
                            ? `${change(first.v) || "no change"} since ${day(readings[first.i].taken_at)}`
                            : ""}
                    </span>
                  </span>
                </div>
              );
            })}

            <div className={styles.timeOverlay}>
              {marks.map((m) => (
                <i key={m.r.id} className={styles.rule} data-kind={m.kind} style={pos(m.x)} />
              ))}
              {hoverX !== null && <i className={styles.rule} data-kind="hover" style={pos(hoverX)} />}
              {readings.map((r, i) => {
                const label = `Compare with ${readingName(r)}, ${when(r.taken_at, clock)}: ${figures(r)}`;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={styles.hit}
                    style={{ left: `${hits[i].from}%`, width: `${hits[i].to - hits[i].from}%` }}
                    aria-label={label}
                    aria-pressed={i === fromIndex}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => pick(r)}
                  />
                );
              })}
              {now && (
                <span
                  className={styles.hit}
                  style={{ left: `${hits[hits.length - 1].to}%`, right: 0 }}
                  onMouseEnter={() => setHover("now")}
                  aria-hidden
                />
              )}
            </div>

            <div className={styles.timeAxis} aria-hidden>
              {xs.map((x, i) => (
                <i
                  key={readings[i].id}
                  className={styles.tick}
                  data-version={!!readings[i].label || undefined}
                  style={pos(x)}
                />
              ))}
              <span className={styles.axisStart}>{day(readings[0].taken_at)}</span>
              <span className={styles.axisEnd}>
                {now ? "Now" : day(readings[readings.length - 1].taken_at)}
              </span>
              {hoverX !== null && (
                <span className={styles.axisHover} data-anchor={anchor(hoverX)} style={pos(hoverX)}>
                  {hoverAt
                    ? `${readingName(hoverAt)} · ${when(hoverAt.taken_at, clock)}`
                    : "The book as it is"}
                </span>
              )}
            </div>
          </div>
          <ul className={numbers.legend} aria-label="What the lines mean">
            <li>
              <i className={styles.keyTick} />a reading
            </li>
            {readings.some((r) => r.label) && (
              <li>
                <i className={styles.keyRule} data-kind="version" />a version
              </li>
            )}
            {fromIndex >= 0 && (
              <li>
                <i className={styles.keyDot} data-kind="from" />
                compared with
              </li>
            )}
            <li>
              <i className={styles.keyDot} data-kind="now" />
              {now ? "now" : "the later reading"}
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
