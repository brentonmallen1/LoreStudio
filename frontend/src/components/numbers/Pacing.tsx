import { useNavigate } from "react-router-dom";
import {
  median,
  niceCeil,
  STATUS_LABEL,
  STATUSES,
  type BeatMark,
  type ChapterSpan,
  type PacingBar,
} from "../../lib/numbers/charts";
import ChapterRow, { SceneTicks } from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * How much room the book gives each scene (doc 13 P3): a column per scene in reading order,
 * on a scale with its top named, the median length drawn across for a reference, and
 * the beat sheet's beats in a row above, where the sheet expects them.
 */
export default function Pacing({
  storyId,
  bars,
  beats,
  chapters,
}: {
  storyId: string;
  bars: PacingBar[];
  beats: BeatMark[];
  chapters: ChapterSpan[];
}) {
  const navigate = useNavigate();
  const n = bars.length;
  const written = bars.filter((b) => b.words > 0).map((b) => b.words);
  const top = niceCeil(Math.max(1, ...written));
  const mid = Math.round(median(written));
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
            {bars.map((b) => (
              <button
                key={b.id}
                type="button"
                className={styles.col}
                title={`${b.title}: ${b.words.toLocaleString()} words, ${STATUS_LABEL[b.status] ?? b.status}`}
                aria-label={`${b.title}, ${b.words} words, ${b.status}`}
                onClick={() => navigate(`/stories/${storyId}/write/${b.id}`)}
              >
                <span
                  className={styles.bar}
                  data-empty={b.words === 0 ? true : undefined}
                  style={{ height: y(b.words), background: `var(--status-${b.status})` }}
                />
              </button>
            ))}
          </div>
          {written.length > 1 && <span className={styles.median} style={{ bottom: y(mid) }} aria-hidden />}
        </div>
        <div className={styles.yAxis} data-side="end" aria-hidden>
          {written.length > 1 && <span style={{ bottom: y(mid) }}>median {mid.toLocaleString()}</span>}
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
      </div>
    </section>
  );
}
