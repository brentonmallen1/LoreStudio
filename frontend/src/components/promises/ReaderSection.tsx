import { useState } from "react";
import { usePromises } from "../../lib/promises/usePromises";
import ReaderKnowledgeTimeline from "../twists/ReaderKnowledgeTimeline";
import PageHeader from "../layout/PageHeader";
import ReaderTable from "./ReaderTable";
import styles from "./Promises.module.css";

type View = "scenes" | "irony" | "entries";

/**
 * What the reader knows (doc 18 C8): scene by scene, what the reader learns, what they are led
 * to believe and what only they know, filled from the twists' clues and reveals plus the
 * author's own entries; or only the dramatic irony; or the entries themselves, to add and edit.
 */
export default function ReaderSection({ storyId }: { storyId: string }) {
  const [view, setView] = useState<View>("scenes");
  const { data } = usePromises(storyId);
  return (
    <div className={styles.page}>
      <PageHeader
        title="What the reader knows"
        summary="Scene by scene: what the reader learns, what they are led to believe, and what only they know"
        views={[
          { id: "scenes", label: "Scene by scene" },
          { id: "irony", label: "Only dramatic irony" },
          { id: "entries", label: "Your entries" },
        ]}
        view={view}
        onView={(v) => setView(v as View)}
        primary={view === "entries" ? undefined : { label: "Add", onClick: () => setView("entries") }}
      />
      <div className={`${styles.body} ${styles.contained}`}>
        {view === "entries" ? (
          <>
            <p className={styles.intro}>
              Clues and reveals come from your twists, so add only what those do not say: what a character
              learns, and what only the reader knows.
            </p>
            <ReaderKnowledgeTimeline storyId={storyId} />
          </>
        ) : (
          <>
            <p className={styles.intro}>
              {view === "irony"
                ? "Dramatic irony: what the reader knows that the characters do not. It turns a quiet scene tense."
                : "Clues and reveals fill this in from your twists; the rest comes from Your entries."}
            </p>
            {data && <ReaderTable storyId={storyId} data={data} ironyOnly={view === "irony"} />}
          </>
        )}
      </div>
    </div>
  );
}
