import SamplesLoader from "../samples/SamplesLoader";
import styles from "../../pages/Settings.module.css";

/** Settings › Account: the samples this library is missing (doc 26, P7). */
export default function ExampleStoriesCard() {
  return (
    <div className={styles.card}>
      <h3 className={styles.settingGroupLabel}>Sample stories</h3>
      <p className={styles.sectionHint}>
        Stories filled in to show what LoreStudio does: a novel with its screenplay and stage play, a short
        story, flash fiction and a series. Delete any you are done with; load them again here.
      </p>
      <SamplesLoader />
    </div>
  );
}
