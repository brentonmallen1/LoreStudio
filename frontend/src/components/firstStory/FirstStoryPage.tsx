import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { readProgress, writeProgress, type Progress } from "../../lib/firstStory/progress";
import { STEPS, type StepId } from "../../lib/firstStory/steps";
import StepBody from "./StepBody";
import styles from "./FirstStory.module.css";

/**
 * My first story (doc 18 C10): seven short steps for a new writer, from an idea in a sentence
 * to the first scene, each saying what it becomes. Every answer is real story data the moment
 * it is saved; skip any step, leave at any point, come back from the palette.
 */
export default function FirstStoryPage({ storyId }: { storyId: string }) {
  const [progress, setProgress] = useState<Progress>(() => readProgress(storyId));
  const at = Math.min(progress.step, STEPS.length - 1);
  const step = STEPS[at];

  function update(patch: Partial<Progress>) {
    setProgress((p) => {
      const next = { ...p, ...patch };
      writeProgress(storyId, next);
      return next;
    });
  }

  function finish(id: StepId, made: Partial<Progress> = {}) {
    const done = progress.done.includes(id) ? progress.done : [...progress.done, id];
    update({ ...made, done, step: Math.min(at + 1, STEPS.length - 1) });
  }

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <span className={styles.barTitle}>My first story</span>
        <Link to={`/stories/${storyId}`} className={styles.leave}>
          Leave the walkthrough; your answers stay
        </Link>
      </header>
      <div className={styles.layout}>
        <nav aria-label="Steps" className={styles.steps}>
          <span className={styles.stepsHint}>Seven short steps. Skip any; come back any time.</span>
          {STEPS.map((s, i) => {
            const done = progress.done.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.stepLink} ${i === at ? styles.stepOn : ""}`}
                aria-current={i === at ? "step" : undefined}
                onClick={() => update({ step: i })}
              >
                <span
                  className={`${styles.badge} ${done ? styles.badgeDone : i === at ? styles.badgeOn : ""}`}
                >
                  {done ? <Check size={12} aria-label="done" /> : i + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{s.title}</span>
                  <span className={styles.stepBecomes}>{s.becomes}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <main className={styles.main}>
          <div className={styles.column}>
            <span className={styles.count}>
              Step {at + 1} of {STEPS.length}
            </span>
            <h1 className={styles.ask}>{step.ask}</h1>
            <p className={styles.explain}>{step.explain}</p>
            <StepBody
              key={step.id}
              step={step}
              storyId={storyId}
              progress={progress}
              onBack={at > 0 ? () => update({ step: at - 1 }) : undefined}
              onSkip={at < STEPS.length - 1 ? () => update({ step: at + 1 }) : undefined}
              onDone={(made) => finish(step.id, made)}
              nextTitle={STEPS[at + 1]?.title}
            />
          </div>
          <aside className={styles.aside}>
            <section className={styles.example} aria-label={step.example.label}>
              <span className={styles.exampleLabel}>{step.example.label}</span>
              {step.example.quote && <p className={styles.exampleQuote}>“{step.example.quote}”</p>}
              <p className={styles.exampleText}>{step.example.text}</p>
            </section>
            <section className={styles.why} aria-label="Why it helps">
              <span className={styles.whyLabel}>Why it helps</span>
              <span>{step.why}</span>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
