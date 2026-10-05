import { stepProgress, type PlanData, type PlanMethod, type PlanStep } from "../../lib/planning/methods";
import StepRail from "./StepRail";
import StoryFieldStep from "./StoryFieldStep";
import CharacterStep from "./CharacterStep";
import SceneListStep from "./SceneListStep";
import BeatStep from "./BeatStep";
import { ThreadPlacementStep, ThreadsStep } from "./ThreadsStep";

interface Props {
  method: PlanMethod;
  data: PlanData;
  initialStep?: string | null;
  onStepChange: (id: string) => void;
  /** Re-read plot threads after a MICE step changes them. */
  reloadThreads: () => void;
}

/** A method's steps down the side, the open step beside them. */
export default function MethodSteps({ method, data, initialStep, onStepChange, reloadThreads }: Props) {
  return (
    <StepRail
      label={method.label}
      steps={method.steps}
      progress={(s) => stepProgress(s, data)}
      renderEditor={(step) => <StepEditor step={step} data={data} reloadThreads={reloadThreads} />}
      initialStep={initialStep}
      onStepChange={onStepChange}
    />
  );
}

function StepEditor({
  step,
  data,
  reloadThreads,
}: {
  step: PlanStep;
  data: PlanData;
  reloadThreads: () => void;
}) {
  const t = step.target;
  const storyId = data.story.id;
  switch (t.kind) {
    case "story":
      return <StoryFieldStep story={data.story} step={{ ...step, target: t }} />;
    case "characters":
      return <CharacterStep storyId={storyId} step={{ ...step, target: t }} />;
    case "beat":
      return <BeatStep storyId={storyId} beatId={t.beatId} beatName={step.label} />;
    case "threads":
      return <ThreadsStep storyId={storyId} threads={data.threads ?? null} reload={reloadThreads} />;
    case "threadPlacement":
      return <ThreadPlacementStep threads={data.threads ?? null} reload={reloadThreads} />;
    default:
      return <SceneListStep storyId={storyId} />;
  }
}
