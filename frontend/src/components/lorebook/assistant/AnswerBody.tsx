import { Wand2 } from "lucide-react";
import type { AssistantResult } from "../../../api/assistantResults";
import { resultSchema } from "../../../lib/ai/resultSchemas";
import type { Subject } from "../../../lib/ai/sheetActions";
import KeptText from "../../ai/kept/KeptText";
import ArcAnalysisBody from "../../characters/ArcAnalysisBody";
import CharacterDepthBody from "../../characters/CharacterDepthBody";
import PortraitDescriptionBody from "../../characters/PortraitDescriptionBody";
import VoiceFidelityBody from "../../characters/VoiceFidelityBody";
import JsonValue from "../../ai/JsonValue";
import StructuredResponseRenderer, { type SectionConfig } from "../../ai/StructuredResponseRenderer";
import ThreadAnalysisBody from "../../threads/ThreadAnalysisBody";
import TwistAnalysisBody from "../../twists/TwistAnalysisBody";
import TwistImpactBody from "../../twists/TwistImpactBody";

const ATTRIBUTES: SectionConfig[] = [
  {
    key: "suggestions",
    label: "Suggestions",
    icon: Wand2,
    color: "var(--color-ai)",
    type: "sublist",
    labelField: "text",
    descField: "rationale",
  },
];

/**
 * A kept answer laid out in its feature's shape (A6, A7): the analyses their own way, the
 * worldbuilding answers through the shared schemas (A1), prose as prose, anything else field
 * by field.
 */
export default function AnswerBody({
  answer,
  subject,
  onChanged,
}: {
  answer: AssistantResult;
  subject: Subject;
  onChanged?: () => void;
}) {
  const { data } = answer;
  switch (answer.feature) {
    case "thread-analysis":
      return <ThreadAnalysisBody data={data} />;
    case "twist-analysis":
      return <TwistAnalysisBody data={data} onClueLinked={onChanged} />;
    case "twist-impact":
      return <TwistImpactBody data={data} />;
    case "character-dimensionality":
      return <CharacterDepthBody data={data} />;
    case "character-attributes":
      return <StructuredResponseRenderer result={{ success: true, data }} schema={ATTRIBUTES} />;
    case "arc-analysis":
      return <ArcAnalysisBody data={data} />;
    case "voice-fidelity":
      return <VoiceFidelityBody data={data} />;
    case "character-from-image":
      return <PortraitDescriptionBody data={data} />;
  }
  // A streamed answer (the arc so far, Plan guidance) is kept as its prose.
  if (typeof data.text === "string") return <KeptText text={data.text} />;
  const schema = resultSchema(
    answer.feature,
    answer.feature === "element-suggest" ? (subject.type === "culture" ? "culture" : "location") : null,
  );
  return schema ? (
    <StructuredResponseRenderer result={{ success: true, data }} schema={schema} />
  ) : (
    <JsonValue value={data} />
  );
}
