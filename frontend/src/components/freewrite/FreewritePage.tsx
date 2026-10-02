import { useState } from "react";
import { useStoryStore } from "../../stores/storyStore";
import PageHeader from "../layout/PageHeader";
import FreewriteEditor from "./FreewriteEditor";
import MadeList from "./MadeList";
import styles from "./Freewrite.module.css";

/**
 * Freewrite (doc 15 N3): a page per story for thinking loosely, a heading for each day.
 * Select words to make them a note, a question, a character or a place; what the page has
 * made is listed beside it.
 */
export default function FreewritePage() {
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const [refs, setRefs] = useState<string[]>([]);
  if (!storyId) return null;
  return (
    <div className={styles.page}>
      <PageHeader
        title="Freewrite"
        summary="Write whatever comes, in any order. Select words to make them part of the story."
      />
      <div className={styles.scroll}>
        <div className={styles.layout}>
          <FreewriteEditor storyId={storyId} onRefs={setRefs} />
          <aside className={styles.side} aria-label="Made from this page">
            <h2 className={styles.sideTitle}>Made from this page</h2>
            <MadeList storyId={storyId} refs={refs} />
          </aside>
        </div>
      </div>
    </div>
  );
}
