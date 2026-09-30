import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import {
  isStepDone,
  nextStep,
  stepProgress,
  type PlanData,
  type PlanMethod,
  type PlanStep,
} from "../../lib/planning/methods";
import StoryFieldStep from "./StoryFieldStep";
import CharacterStep from "./CharacterStep";
import SceneListStep from "./SceneListStep";
import styles from "./Plan.module.css";

interface Props {
  method: PlanMethod;
  data: PlanData;
  initialStep?: string | null;
  onStepChange: (id: string) => void;
}

/** A method's steps down the side, the open step beside them. */
export default function MethodSteps({ method, data, initialStep, onStepChange }: Props) {
  const [stepId, setStepId] = useState(
    () =>
      method.steps.find((s) => s.id === initialStep)?.id ?? nextStep(method, data)?.id ?? method.steps[0].id,
  );
  const index = Math.max(
    0,
    method.steps.findIndex((s) => s.id === stepId),
  );
  const step = method.steps[index];

  function go(id: string) {
    setStepId(id);
    onStepChange(id);
  }

  return (
    <div className={styles.method}>
      <ol className={styles.stepList} aria-label={`${method.label} steps`}>
        {method.steps.map((s, i) => {
          const { done, total } = stepProgress(s, data);
          const complete = done === total;
          return (
            <li key={s.id}>
              <button
                className={`${styles.stepLink} ${s.id === step.id ? styles.stepLinkActive : ""}`}
                aria-current={s.id === step.id ? "step" : undefined}
                onClick={() => go(s.id)}
              >
                <span className={complete ? styles.done : styles.todo}>
                  {complete ? (
                    <CheckCircle2 size={15} />
                  ) : done > 0 ? (
                    <CircleDashed size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                </span>
                <span className={styles.stepNum}>{i + 1}</span>
                <span className={styles.stepName}>{s.label}</span>
                {total > 1 && (
                  <span className={styles.stepCount}>
                    {done}/{total}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <section className={styles.stepPanel} aria-labelledby="plan-step-title">
        <p className={styles.stepEyebrow}>
          Step {index + 1} of {method.steps.length}
          {isStepDone(step, data) && <span className={styles.stepDone}> · Done</span>}
        </p>
        <h3 id="plan-step-title" className={styles.stepTitle}>
          {step.label}
        </h3>
        <p className={styles.stepWhy}>{step.why}</p>
        <p className={styles.stepHow}>{step.how}</p>
        <details className={styles.example}>
          <summary>Example from The Last Lighthouse</summary>
          <p>{step.example}</p>
        </details>

        <StepEditor key={step.id} step={step} data={data} />

        <div className={styles.stepNav}>
          {index > 0 ? (
            <button className={styles.quietBtn} onClick={() => go(method.steps[index - 1].id)}>
              <ArrowLeft size={13} />
              {method.steps[index - 1].label}
            </button>
          ) : (
            <span />
          )}
          {index < method.steps.length - 1 && (
            <button className={styles.primaryBtn} onClick={() => go(method.steps[index + 1].id)}>
              Next: {method.steps[index + 1].label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function StepEditor({ step, data }: { step: PlanStep; data: PlanData }) {
  const t = step.target;
  if (t.kind === "story") return <StoryFieldStep story={data.story} step={{ ...step, target: t }} />;
  if (t.kind === "characters") return <CharacterStep storyId={data.story.id} step={{ ...step, target: t }} />;
  return <SceneListStep storyId={data.story.id} />;
}
