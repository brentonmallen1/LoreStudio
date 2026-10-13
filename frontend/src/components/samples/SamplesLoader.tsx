import { useExampleStories } from "../../hooks/useExampleStories";
import styles from "./SamplesLoader.module.css";

/**
 * The samples this library is missing, and Load samples (doc 26, P7): stories filled in to show
 * what LoreStudio does, titled "Sample: Kind · Title". Guides › Getting started and Settings ›
 * Account.
 */
export default function SamplesLoader() {
  const { missing, adding, add } = useExampleStories();
  if (missing.length === 0) return <p className={styles.note}>Every sample is in your library.</p>;
  return (
    <div className={styles.loader}>
      <ul className={styles.list} aria-label="Samples not in your library">
        {missing.map((title) => (
          <li key={title}>{title.replace(/^Sample: /, "")}</li>
        ))}
      </ul>
      <button type="button" className={styles.button} onClick={add} disabled={adding}>
        {adding ? "Loading…" : missing.length === 1 ? "Load the sample" : `Load ${missing.length} samples`}
      </button>
    </div>
  );
}
