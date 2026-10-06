import { useNavigate } from "react-router-dom";
import { median, niceCeil, STATUS_LABEL, STATUSES } from "../../lib/numbers/charts";
import { sceneChanges } from "../../lib/numbers/compare";
import type { Figures } from "../../lib/numbers/figures";
import ChapterRow, { SceneTicks } from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * How much room the book gives each scene (doc 13 P3): a column per scene in reading order,
 * on a scale with its top named, the median length drawn across for a reference, and
 * the beat sheet's beats in a row above, where the sheet expects them. Compared (doc 19),
 * each column's earlier height is an outline behind it, a scene new since then is ringed,
 * and the earlier median is a fainter line.
 */
export default function Pacing({
  storyId,
  now,
  then,
}: {
  storyId: string;
  now: Figures;
  then: Figures | null;
}) {
  const navigate = useNavigate();
  const { bars, beats, chapters } = now;
  const n = bars.length;
  const written = bars.filter((b) => b.words > 0).map((b) => b.words);
  const changes = then ? sceneChanges(then, now) : null;
  const thenWritten = then ? then.bars.filter((b) => b.words > 0).map((b) => b.words) : [];
  const top = niceCeil(Math.max(1, ...written, ...bars.map((b) => changes?.wordsThen.get(b.id) ?? 0)));
  const mid = Math.round(median(written));
  const midThen = Math.round(median(thenWritten));
  const y = (words: number) => `${(words / top) * 100}%`;
  const x = (i: number) => `${((i + 0.5) / n) * 100}%`;
  // A beat sits over the scene where the book's words pass the share the sheet puts it at.
  const column = (at: number) => {
    const i = bars.findIndex((b) => b.through >= at);
    return i < 0 ? n - 1 : i;
  };
  const stacked = new Map<number, number>();
  const statuses = STATUSES.filter((s) => bars.some((b) => b.status === s));

  return (
    <section className={styles.section} aria-labelledby="numbers-pacing">
      <SectionHeading section="pacing" title="Pacing" />
      <p className={styles.lede}>
        Each column is a scene, as tall as its words and coloured by its state. The line across is the median
        length: half the written scenes are longer, half shorter.
        {beats.length > 0 && " The dots above are the beat sheet's beats where it expects them."}
      </p>
      <div className={styles.score} style={{ "--cols": n } as React.CSSProperties}>
        <ChapterRow chapters={chapters} />
        {beats.length > 0 && (
          <>
            <span className={styles.axisLabel}>Beats</span>
            <div className={styles.beatRow}>
              {beats.map((b) => {
                const i = column(b.at);
                const k = stacked.get(i) ?? 0;
                stacked.set(i, k + 1);
                return (
                  <span
                    key={b.id}
                    className={styles.beat}
                    data-placed={b.sceneId ? true : undefined}
                    style={{ left: `calc(${x(i)} + ${k * 0.6}rem)` }}
                    title={`${b.name}${b.sceneId ? "" : " (no scene yet)"}`}
                  />
                );
              })}
            </div>
            <span />
          </>
        )}
        <div className={styles.yAxis} aria-hidden>
          <span style={{ bottom: "100%" }}>{top.toLocaleString()} words</span>
          <span style={{ bottom: 0 }}>0</span>
        </div>
        <div className={styles.plot}>
          <span className={styles.gridline} style={{ bottom: "100%" }} aria-hidden />
          <div className={styles.cols}>
            {bars.map((b) => {
              const was = changes?.wordsThen.get(b.id);
              const isNew = changes?.added.has(b.id);
              const note = isNew
                ? ", new since then"
                : was !== undefined && was !== b.words
                  ? `, was ${was.toLocaleString()}`
                  : "";
              return (
                <button
                  key={b.id}
                  type="button"
                  className={styles.col}
                  title={`${b.title}: ${b.words.toLocaleString()} words${note}, ${STATUS_LABEL[b.status] ?? b.status}`}
                  aria-label={`${b.title}, ${b.words} words${note}, ${b.status}`}
                  onClick={() => navigate(`/stories/${storyId}/write/${b.id}`)}
                >
                  <span
                    className={styles.bar}
                    data-empty={b.words === 0 ? true : undefined}
                    data-new={isNew || undefined}
                    style={{ height: y(b.words), background: `var(--status-${b.status})` }}
                  />
                  {was !== undefined && was > 0 && (
                    <span className={styles.barThen} style={{ height: y(was) }} aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
          {written.length > 1 && <span className={styles.median} style={{ bottom: y(mid) }} aria-hidden />}
          {thenWritten.length > 1 && midThen !== mid && (
            <span className={styles.medianThen} style={{ bottom: y(midThen) }} aria-hidden />
          )}
        </div>
        <div className={styles.yAxis} data-side="end" aria-hidden>
          {written.length > 1 && <span style={{ bottom: y(mid) }}>median {mid.toLocaleString()}</span>}
          {thenWritten.length > 1 && midThen !== mid && (
            <span
              style={{ bottom: y(midThen) }}
              data-then
              data-near={
                Math.abs(mid - midThen) / top < 0.1 ? (midThen < mid ? "below" : "above") : undefined
              }
            >
              was {midThen.toLocaleString()}
            </span>
          )}
        </div>
        <SceneTicks count={n} />
      </div>
      <div className={styles.legend}>
        {statuses.map((s) => (
          <span key={s}>
            <i className={styles.swatch} data-status={s} style={{ background: `var(--status-${s})` }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        {written.length > 1 && (
          <span>
            <i className={styles.medianKey} />
            median length
          </span>
        )}
        {beats.length > 0 && (
          <>
            <span>
              <i className={styles.beatKey} data-placed />a beat with a scene
            </span>
            <span>
              <i className={styles.beatKey} />a beat with none yet
            </span>
          </>
        )}
        {changes && (
          <>
            <span>
              <i className={styles.thenKey} />
              length then
            </span>
            {changes.added.size > 0 && (
              <span>
                <i className={styles.newKey} />
                new since then
              </span>
            )}
          </>
        )}
      </div>
      {changes && (changes.removed.length > 0 || changes.moved.length > 0) && (
        <p className={styles.lede}>
          {changes.removed.length > 0 &&
            `Removed since then: ${changes.removed.map((r) => `“${r.title}”`).join(", ")}. `}
          {changes.moved.length > 0 &&
            `Moved: ${changes.moved.map((m) => `“${m.title}” from ${m.from} to ${m.to}`).join(", ")}.`}
        </p>
      )}
    </section>
  );
}
