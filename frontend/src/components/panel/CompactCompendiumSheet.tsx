import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { CompendiumEntry } from "../../types";
import styles from "./Panel.module.css";

/** A research entry beside the prose: enough to check a fact without leaving the page. */
export default function CompactCompendiumSheet({ entryId }: { entryId: string }) {
  const [entry, setEntry] = useState<CompendiumEntry | null | undefined>(undefined);
  useEffect(() => {
    api
      .getCompendiumEntry(entryId)
      .then(setEntry)
      .catch(() => setEntry(null));
  }, [entryId]);

  if (entry === undefined) return <p className={`${styles.section} ${styles.empty}`}>Loading…</p>;
  if (entry === null) return <p className={`${styles.section} ${styles.empty}`}>This entry is gone.</p>;
  return (
    <section className={styles.section}>
      <p className={styles.sub}>
        {entry.entry_type}
        {entry.category ? ` · ${entry.category}` : ""}
      </p>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer" className={styles.text}>
          {entry.url_title || entry.url}
        </a>
      )}
      {entry.url_description && <p className={styles.text}>{entry.url_description}</p>}
      {entry.content && (
        <p className={styles.text}>{entry.content.replace(/<[^>]+>/g, " ").slice(0, 1200)}</p>
      )}
      {entry.notes && (
        <div className={styles.field}>
          <span className={styles.label}>Your notes</span>
          <p className={styles.text}>{entry.notes}</p>
        </div>
      )}
      {entry.tags.length > 0 && (
        <div className={styles.chips}>
          {entry.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
