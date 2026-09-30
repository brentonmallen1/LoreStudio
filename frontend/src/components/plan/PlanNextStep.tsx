import { useNavigate } from "react-router-dom";
import { ArrowRight, MapIcon } from "lucide-react";
import { isStepDone, nextStep } from "../../lib/planning/methods";
import { usePlanData } from "../../lib/planning/usePlanData";
import styles from "./PlanNextStep.module.css";

/**
 * The Overview's plan card (refactor doc 10 P6): the method, how far it has got, and the
 * one next thing to do. Shown once a method is chosen; never a gate in front of writing.
 */
export default function PlanNextStep({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const { data, method } = usePlanData();
  if (!data || !method) return null;

  const done = method.steps.filter((s) => isStepDone(s, data)).length;
  const next = nextStep(method, data);
  const pct = Math.round((done / method.steps.length) * 100);

  return (
    <section className={styles.card} aria-label="Plan">
      <div className={styles.head}>
        <MapIcon size={14} className={styles.icon} />
        <span className={styles.title}>{method.label}</span>
        <span className={styles.count}>
          {done} of {method.steps.length} steps
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Plan progress"
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      {next ? (
        <button className={styles.next} onClick={() => navigate(`/stories/${storyId}/plan?step=${next.id}`)}>
          <span className={styles.nextText}>
            <span className={styles.nextLabel}>Next: {next.label}</span>
            <span className={styles.nextWhy}>{next.why}</span>
          </span>
          <ArrowRight size={14} />
        </button>
      ) : (
        <button className={styles.next} onClick={() => navigate(`/stories/${storyId}/plan`)}>
          <span className={styles.nextText}>
            <span className={styles.nextLabel}>Every step has an answer</span>
            <span className={styles.nextWhy}>
              The plan is there when you need it; the scenes are in the tree.
            </span>
          </span>
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}
