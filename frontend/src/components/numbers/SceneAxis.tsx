import type { ChapterSpan } from "../../lib/numbers/charts";
import styles from "./Numbers.module.css";

/** "Chapter 3: Old Records" says its number twice once the number is drawn: keep the name. */
const NUMBERED = /^(chapter|ch\.?|part|act)\s*(\d+|[ivxlc]+)\b\s*[:.\-–—]?\s*/i;

/**
 * The chapters over a chart with a column per scene. Pacing, threads, the cast and whose eyes
 * all lay their scenes out the same way, so a column is the same scene in each of them.
 * Nothing is drawn for a book in one chapter, where it would only repeat the book's name.
 */
export default function ChapterRow({ chapters }: { chapters: ChapterSpan[] }) {
  if (chapters.length < 2) return null;
  return (
    <>
      <span />
      <div className={styles.chapters} aria-hidden>
        {chapters.map((c, i) => (
          <span
            key={`${c.id}-${c.first}`}
            className={styles.chapter}
            style={{ gridColumn: `${c.first + 1} / span ${c.count}` }}
            title={c.title}
          >
            <b>{i + 1}</b> {c.title.replace(NUMBERED, "")}
          </span>
        ))}
      </div>
      <span />
    </>
  );
}

/**
 * The scene axis under a chart: scenes numbered in reading order, every one in a short book
 * and every fifth or tenth in a long one, so a column can be named ("scene 14") at a glance.
 */
export function SceneTicks({ count }: { count: number }) {
  const every = count <= 20 ? 1 : count <= 60 ? 5 : 10;
  return (
    <>
      <span className={styles.axisLabel}>Scene</span>
      <div className={`${styles.cols} ${styles.ticks}`} aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i}>{i === 0 || (i + 1) % every === 0 ? i + 1 : ""}</span>
        ))}
      </div>
      <span />
    </>
  );
}
