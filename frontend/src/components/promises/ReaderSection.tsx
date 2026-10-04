import { useState } from "react";
import ReaderKnowledgeTimeline from "../twists/ReaderKnowledgeTimeline";
import PageHeader from "../layout/PageHeader";
import styles from "./Promises.module.css";

/**
 * What the reader knows (doc 18 C3), a section of Promises: scene by scene, what the reader
 * learns, is led to believe and alone knows; or only the dramatic irony.
 */
export default function ReaderSection({ storyId }: { storyId: string }) {
  const [view, setView] = useState<"scenes" | "irony">("scenes");
  return (
    <div className={styles.page}>
      <PageHeader
        title="What the reader knows"
        summary="What the reader learns, scene by scene, and what only they know"
        views={[
          { id: "scenes", label: "Scene by scene" },
          { id: "irony", label: "Only dramatic irony" },
        ]}
        view={view}
        onView={(v) => setView(v as "scenes" | "irony")}
      />
      <div className={styles.body}>
        <ReaderKnowledgeTimeline storyId={storyId} ironyOnly={view === "irony"} />
      </div>
    </div>
  );
}
