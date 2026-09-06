import type { AISession } from "../../stores/aiStore";
import AssistantMode from "./modes/AssistantMode";
import InterviewMode from "./modes/InterviewMode";
import SceneAssistantMode from "./modes/SceneAssistantMode";
import StoryAssistantMode from "./modes/StoryAssistantMode";
import WritingCoachMode from "./modes/WritingCoachMode";
import WhatIfMode from "./modes/WhatIfMode";
import PanelMode from "./modes/PanelMode";
import ShowDontTellMode from "./modes/ShowDontTellMode";
import AudienceAdherenceMode from "./modes/AudienceAdherenceMode";
import BookDescriptionMode from "./modes/BookDescriptionMode";
import QueryLetterMode from "./modes/QueryLetterMode";
import SceneAtmosphereMode from "./modes/SceneAtmosphereMode";
import ClicheCoachMode from "./modes/ClicheCoachMode";
import DiscoveryQuestionsMode from "./modes/DiscoveryQuestionsMode";
import AttributeGeneratorMode from "./modes/AttributeGeneratorMode";
import StoryIdentityWorkshopMode from "./modes/StoryIdentityWorkshopMode";
import styles from "./SessionView.module.css";
import AnalysisResultMode from "./modes/AnalysisResultMode";

interface Props {
  session: AISession;
}

export default function SessionView({ session }: Props) {
  switch (session.type) {
    case "analysis-result":
      return <AnalysisResultMode session={session} />;
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
    case "show-dont-tell":
      return <ShowDontTellMode session={session} />;
    case "audience-adherence":
      return <AudienceAdherenceMode session={session} />;
    case "book-description":
      return <BookDescriptionMode session={session} />;
    case "query-letter":
      return <QueryLetterMode session={session} />;
    case "scene-atmosphere":
      return <SceneAtmosphereMode session={session} />;
    case "cliche-coach":
      return <ClicheCoachMode session={session} />;
    case "discovery-questions":
      return <DiscoveryQuestionsMode session={session} />;
    case "attribute-generator":
      return <AttributeGeneratorMode session={session} />;
    case "story-identity-workshop":
      return <StoryIdentityWorkshopMode session={session} />;
    default:
      return (
        <div className={styles.unknown}>
          <p>
            Unknown session type: <code>{session.type}</code>
          </p>
        </div>
      );
  }
}
