import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, CircleDashed, MapIcon } from "lucide-react";
import { stepProgress } from "../../lib/planning/methods";
import { usePlanData } from "../../lib/planning/usePlanData";
import page from "../../pages/StoryHealthPage.module.css";
import styles from "./PlanProgressCard.module.css";

/** How far the story's planning method has got, step by step; each step opens on the Plan page. */
export default function PlanProgressCard({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const { data, method } = usePlanData();
  if (!data || !method) return null;

  const steps = method.steps.map((s) => ({ step: s, ...stepProgress(s, data) }));
  const complete = steps.filter((s) => s.done === s.total).length;

  return (
    <section className={page.card}>
      <div className={page.cardHeader}>
        <MapIcon size={14} className={page.cardIcon} />
        <h3 className={page.cardTitle}>Plan: {method.label}</h3>
      </div>
      <p className={page.bigStatSub} style={{ marginBottom: "0.75rem" }}>
        {complete}/{steps.length} steps done
      </p>
      <div className={page.beatList}>
        {steps.map(({ step, done, total }) => (
          <button
            key={step.id}
            className={`${page.beatItem} ${styles.step}`}
            onClick={() => navigate(`/stories/${storyId}/plan?step=${step.id}`)}
          >
            <span className={done === total ? page.beatAssigned : page.beatUnassigned}>
              {done === total ? (
                <CheckCircle2 size={12} />
              ) : done > 0 ? (
                <CircleDashed size={12} />
              ) : (
                <Circle size={12} />
              )}
            </span>
            <span className={page.beatName}>
              {step.label}
              {total > 1 && ` (${done}/${total})`}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
