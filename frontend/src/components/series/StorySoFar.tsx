import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { seriesApi, type BookSoFar, type Series, type SoFarItem } from "../../api/series";
import { fieldLabel, sheetPath } from "../../lib/series/kinds";
import { bookLabel } from "../../stores/seriesStore";
import styles from "./SeriesPages.module.css";

function Items({ items, label }: { items: SoFarItem[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.soFarGroup}>
      <h4 className={styles.soFarLabel}>{label}</h4>
      <ul className={styles.plainList}>
        {items.map((item, i) => (
          <li key={i} className={item.over ? styles.over : ""}>
            {item.node_id ? (
              <Link to={`/stories/${item.story_id}/write/${item.node_id}`}>{item.text}</Link>
            ) : (
              item.text
            )}
            {item.over && <span className={styles.note}> no longer, after {item.over}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The story so far (v1.5): a card per book, in reading order, each saying what the reader
 * carries out of it. Its summary; where the characters the series shares end up, what
 * changed for each; what the reader learned, still believes (struck through once a later
 * book overturns it) and alone knows; and what is still open. A reminder before the next
 * book, read from the books themselves.
 */
export default function StorySoFar({ series }: { series: Series }) {
  const [read, setRead] = useState<{ id: string; cards: BookSoFar[] | null } | null>(null);
  const { hash } = useLocation();
  useEffect(() => {
    let live = true;
    seriesApi.storySoFar(series.id).then(
      (cards) => live && setRead({ id: series.id, cards }),
      () => live && setRead({ id: series.id, cards: null }),
    );
    return () => {
      live = false;
    };
  }, [series.id, series.books]);
  const cards = read?.id === series.id ? read.cards : null;
  // "The story so far" from a book's Coming in row lands on the book before it.
  useEffect(() => {
    if (cards && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [cards, hash]);
  if (!read) return <p className={styles.quiet}>Reading the books…</p>;
  if (!cards) return <p className={styles.quiet}>The books could not be read.</p>;

  return (
    <div className={styles.stack}>
      {cards.map((c) => (
        <article key={c.story_id} id={`book-${c.position}`} className={styles.soFarCard}>
          <header className={styles.soFarHead}>
            <span className={styles.ordinal}>{bookLabel(c.position)}</span>
            <Link to={`/stories/${c.story_id}`} className={styles.soFarTitle}>
              {c.title}
            </Link>
          </header>
          {c.summary ? (
            <p className={styles.summary}>{c.summary}</p>
          ) : (
            <p className={styles.quiet}>No summary yet: write one on the book's Plan or Story identity.</p>
          )}
          {c.characters.length > 0 && (
            <div className={styles.soFarGroup}>
              <h4 className={styles.soFarLabel}>Where they end up</h4>
              <ul className={styles.plainList}>
                {c.characters.map((ch) => (
                  <li key={ch.ref_id}>
                    <Link to={sheetPath(c.story_id, "character", ch.ref_id)}>{ch.name}</Link>
                    {ch.first_here && <span className={styles.note}> first in this book</span>}
                    {Object.keys(ch.changed).length === 0 ? (
                      <span className={styles.note}> as the book before left them</span>
                    ) : (
                      Object.entries(ch.changed).map(([key, value]) => (
                        <span key={key} className={styles.changed}>
                          <span className={styles.fieldName}>{fieldLabel("character", key)}</span> {value}
                        </span>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Items items={c.learned} label="The reader learns" />
          <Items items={c.believes} label="…and is led to believe" />
          <Items items={c.only} label="Only the reader knows" />
          {c.open.length > 0 && (
            <div className={styles.soFarGroup}>
              <h4 className={styles.soFarLabel}>Still open as it ends</h4>
              <ul className={styles.plainList}>
                {c.open.map((o) => (
                  <li key={o.ref_id}>
                    <Link to={sheetPath(o.story_id, o.kind === "thread" ? "plot_thread" : "twist", o.ref_id)}>
                      {o.name}
                    </Link>
                    <span className={styles.note}> {o.said}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
