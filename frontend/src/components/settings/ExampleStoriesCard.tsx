import SamplesLoader from "../samples/SamplesLoader";
import styles from "../../pages/Settings.module.css";

/** Settings › Account: every sample, each loaded on its own (doc 26, P7). */
export default function ExampleStoriesCard() {
  return (
    <div className={styles.card}>
      <h3 className={styles.settingGroupLabel}>Sample stories</h3>
      <p className={styles.sectionHint}>
        Stories filled in to show what LoreStudio does: a novel with its screenplay and stage play, a short
        story, flash fiction and a series. Load one at a time or all of them; delete any you are done with and
        load it again here.
      </p>
      <SamplesLoader />
    </div>
  );
}
