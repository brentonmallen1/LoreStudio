import { useState } from "react";
import { seriesApi, type Series } from "../../api/series";
import { toast } from "../../stores/toastStore";
import styles from "./Series.module.css";

/** The series' own name, premise and intent, saved as each field is left (keyed: a saved
 * change remounts it with the new values). */
export default function SeriesIdentity({
  series,
  onSaved,
}: {
  series: Series;
  onSaved: (s: Series) => void;
}) {
  const [draft, setDraft] = useState({ name: series.name, premise: series.premise, intent: series.intent });

  async function save(key: keyof typeof draft) {
    const value = draft[key];
    if (value === series[key] || (key === "name" && !value.trim())) {
      setDraft((d) => ({ ...d, [key]: series[key] }));
      return;
    }
    try {
      onSaved(await seriesApi.update(series.id, { [key]: value }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That could not be saved.");
    }
  }

  return (
    <section className={styles.identity} aria-label="About the series">
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => save("name")}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Premise: what the books are about, together</span>
        <textarea
          className={styles.textarea}
          value={draft.premise}
          onChange={(e) => setDraft({ ...draft, premise: e.target.value })}
          onBlur={() => save("premise")}
          placeholder="A lighthouse, and the three generations who keep it…"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Intent: what the series is for</span>
        <textarea
          className={styles.textarea}
          value={draft.intent}
          onChange={(e) => setDraft({ ...draft, intent: e.target.value })}
          onBlur={() => save("intent")}
          placeholder="Where it is going across the books, and why it needs more than one…"
        />
      </label>
    </section>
  );
}
