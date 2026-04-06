import type { AISession } from "../../stores/aiStore";
import InterviewMode from "./modes/InterviewMode";
import SceneAssistantMode from "./modes/SceneAssistantMode";
import StoryAssistantMode from "./modes/StoryAssistantMode";
import styles from "./SessionView.module.css";

interface Props {
  session: AISession;
}

export default function SessionView({ session }: Props) {
  switch (session.type) {
    case "interview":
      return <InterviewMode session={session} />;
    case "scene-assistant":
      return <SceneAssistantMode session={session} />;
    case "story-assistant":
      return <StoryAssistantMode session={session} />;
    default:
      return (
        <div className={styles.unknown}>
          <p>Unknown session type: <code>{session.type}</code></p>
        </div>
      );
  }
}
