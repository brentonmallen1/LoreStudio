import { Check } from "lucide-react";
import { useExampleStories } from "../../hooks/useExampleStories";
import styles from "./SamplesLoader.module.css";

/** "Sample: Novel · The Last Lighthouse" → ["Novel", "The Last Lighthouse"]. */
function parts(title: string): [string, string] {
  const [kind, ...rest] = title.replace(/^Sample: /, "").split(" · ");
  return [kind, rest.join(" · ")];
}

/**
 * Every sample (doc 26, P7): stories filled in to show what LoreStudio does, titled "Sample: Kind
 * · Title". Each loads on its own; one already in the library says so (Brenton, 2026-10-13: one at
 * a time, and never hidden). Load all takes every missing one. Guides › Getting started and
 * Settings › Account.
 */
export default function SamplesLoader() {
  const { samples, missing, loading, add } = useExampleStories();
  if (samples.length === 0) return null;
  const busy = loading !== null;

  return (
    <div className={styles.loader}>
      <ul className={styles.list} aria-label="Samples">
        {samples.map((sample) => {
          const [kind, name] = parts(sample.title);
          return (
            <li key={sample.title} className={styles.row}>
              <span className={styles.name}>
                <span className={styles.kind}>{kind}</span>
                <span className={styles.title}>{name}</span>
                {!sample.loaded && sample.needs.length > 0 && (
                  <span className={styles.needs}>
                    Also loads the {parts(sample.needs[0])[0].toLowerCase()} it follows
                  </span>
                )}
              </span>
              {sample.loaded ? (
                <span className={styles.have}>
                  <Check size={13} aria-hidden />
                  In your library
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.load}
                  onClick={() => add(sample.title)}
                  disabled={busy}
                  aria-label={`Load ${sample.title}`}
                >
                  {loading === sample.title ? "Loading…" : "Load"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {missing.length > 1 && (
        <button type="button" className={styles.button} onClick={() => add()} disabled={busy}>
          {loading === "all" ? "Loading…" : `Load all ${missing.length}`}
        </button>
      )}
    </div>
  );
}
