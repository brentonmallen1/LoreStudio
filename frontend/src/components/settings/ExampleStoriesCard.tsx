import { useExampleStories } from "../../hooks/useExampleStories";
import styles from "../../pages/Settings.module.css";

/** Settings › Account: add the example stories this library is missing. Only the admin account
 * the app made holds them, so other accounts see nothing. */
export default function ExampleStoriesCard() {
  const { available, missing, adding, add } = useExampleStories();
  if (!available) return null;
  return (
    <div className={styles.card}>
      <h3 className={styles.settingGroupLabel}>Example stories</h3>
      <p className={styles.sectionHint}>
        {missing.length === 0
          ? "Every example story is in your library."
          : `Sample stories that show what LoreStudio does. Not in your library: ${missing.join(", ")}.`}
      </p>
      {missing.length > 0 && (
        <div className={styles.cardFooter}>
          <button className={styles.saveBtn} onClick={add} disabled={adding}>
            {adding ? "Adding…" : "Add example stories"}
          </button>
        </div>
      )}
    </div>
  );
}
