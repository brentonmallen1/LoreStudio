import { Fragment, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { firstOpen, type PlanStep } from "../../lib/planning/methods";
import styles from "./Plan.module.css";

interface Props<T> {
  /** What the steps are of, for the list's label: "Snowflake Method steps". */
  label: string;
  steps: PlanStep<T>[];
  progress: (step: PlanStep<T>) => { done: number; total: number };
  renderEditor: (step: PlanStep<T>) => ReactNode;
  initialStep?: string | null;
  onStepChange?: (id: string) => void;
  /** Whose example a step quotes. */
  exampleFrom?: string;
}

/**
 * A plan's steps down the side, the open step beside them: why it matters, how to write it,
 * an example, and its editor. The book's methods (MethodSteps) and the series' plan
 * (SeriesSteps) are both this rail with their own editors.
 */
export default function StepRail<T>({
  label,
  steps,
  progress,
  renderEditor,
  initialStep,
  onStepChange,
  exampleFrom = "The Last Lighthouse",
}: Props<T>) {
  const [stepId, setStepId] = useState(
    () => steps.find((s) => s.id === initialStep)?.id ?? firstOpen(steps, progress)?.id ?? steps[0]?.id,
  );
  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  );
  const step = steps[index];
  if (!step) return null;

  function go(id: string) {
    setStepId(id);
    onStepChange?.(id);
  }
  const stepDone = (s: PlanStep<T>) => {
    const { done, total } = progress(s);
    return done === total;
  };

  return (
    <div className={styles.method}>
      <ol className={styles.stepList} aria-label={`${label} steps`}>
        {steps.map((s, i) => {
          const { done, total } = progress(s);
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
                <span className={styles.stepName}>
                  {s.label}
                  {s.optional && <span className={styles.stepCount}> · if you like</span>}
                </span>
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
          Step {index + 1} of {steps.length}
          {stepDone(step) && <span className={styles.stepDone}> · Done</span>}
          {step.optional && !stepDone(step) && " · if it helps"}
        </p>
        <h3 id="plan-step-title" className={styles.stepTitle}>
          {step.label}
        </h3>
        <p className={styles.stepWhy}>{step.why}</p>
        <p className={styles.stepHow}>{step.how}</p>
        {step.example && (
          <details className={styles.example}>
            <summary>Example from {exampleFrom}</summary>
            <p>{step.example}</p>
          </details>
        )}

        <Fragment key={step.id}>{renderEditor(step)}</Fragment>

        <div className={styles.stepNav}>
          {index > 0 ? (
            <button className={styles.quietBtn} onClick={() => go(steps[index - 1].id)}>
              <ArrowLeft size={13} />
              {steps[index - 1].label}
            </button>
          ) : (
            <span />
          )}
          {index < steps.length - 1 && (
            <button className={styles.primaryBtn} onClick={() => go(steps[index + 1].id)}>
              Next: {steps[index + 1].label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
