import type { AISession } from "../../stores/aiStore";
import AssistantMode from "./modes/AssistantMode";
import InterviewMode from "./modes/InterviewMode";
import SceneAssistantMode from "./modes/SceneAssistantMode";
import StoryAssistantMode from "./modes/StoryAssistantMode";
import WritingCoachMode from "./modes/WritingCoachMode";
import WhatIfMode from "./modes/WhatIfMode";
import PanelMode from "./modes/PanelMode";
import styles from "./SessionView.module.css";

interface Props {
  session: AISession;
}

export default function SessionView({ session }: Props) {
  switch (session.type) {
    case "assistant":
      return <AssistantMode session={session} />;
    case "interview":
      return <InterviewMode session={session} />;
    case "scene-assistant":
      return <SceneAssistantMode session={session} />;
    case "story-assistant":
      return <StoryAssistantMode session={session} />;
    case "writing-coach":
      return <WritingCoachMode session={session} />;
    case "whatif":
      return <WhatIfMode session={session} />;
    case "panel":
      return <PanelMode session={session} />;
    default:
      return (
        <div className={styles.unknown}>
          <p>Unknown session type: <code>{session.type}</code></p>
        </div>
      );
  }
}
