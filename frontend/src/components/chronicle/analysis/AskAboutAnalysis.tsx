import { Compass } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import { useAIAvailable } from "../../../lib/mode";
import type { ActivityLog } from "../../../types";
import styles from "./Analysis.module.css";

/**
 * Takes a finished analysis into the AI panel as a session, so it can be asked about
 * rather than read and closed (doc 06 §2.1). Chronicle keeps the permanent record either
 * way; this is about having one place to find AI output while you are working.
 */
export default function AskAboutAnalysis({ log, label }: { log: ActivityLog; label: string }) {
  const { openResultSession } = useAIStore();
  const aiAvailable = useAIAvailable();

  if (!aiAvailable) return null;

  return (
    <button
      className={styles.openInPanel}
      onClick={() =>
        openResultSession({
          feature: (log.metadata_?.feature as string) ?? "",
          heading: label,
          data: log.metadata_?.result,
          context: { storyId: log.story_id ?? undefined },
        })
      }
      title="Open this analysis in the AI panel and ask about it"
    >
      <Compass size={11} /> Ask about this
    </button>
  );
}
