import { useState } from "react";
import { Compass } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Story } from "../../types";
import type { PlanStep, StoryPlanField } from "../../lib/planning/methods";
import AIOnly from "../ai/AIOnly";
import PlanGuidance from "./PlanGuidance";
import { countWords, useAutosaveField } from "./useAutosaveField";
import styles from "./Plan.module.css";

/** Fields Story Identity shows too, so the author knows it's one value, not a copy. */
const ON_IDENTITY = new Set<StoryPlanField>(["logline", "premise", "central_conflict"]);

const FIELD_NAMES: Record<StoryPlanField, string> = {
  logline: "Logline",
  premise: "Premise",
  central_conflict: "Central conflict",
  paragraph_summary: "One-paragraph summary",
  synopsis: "Synopsis",
};

interface Props {
  story: Story;
  step: PlanStep & { target: { kind: "story"; field: StoryPlanField } };
}

/** A step that writes one story field: the logline, the paragraph, the synopsis… */
export default function StoryFieldStep({ story, step }: Props) {
  const field = step.target.field;
  const setActiveStory = useStoryStore((s) => s.setActiveStory);
  const [guidance, setGuidance] = useState(false);
  const { value, change, flush } = useAutosaveField(story[field] ?? "", async (v) => {
    const updated = await api.updateStory(story.id, { [field]: v });
    setActiveStory(updated);
  });
  const words = countWords(value);
  const source = step.buildsOn ? story[step.buildsOn] : "";

  return (
    <div className={styles.stepBody}>
      {step.buildsOn && source?.trim() && (
        <div className={styles.buildsOn}>
          <span className={styles.buildsOnLabel}>
            Growing from your {FIELD_NAMES[step.buildsOn].toLowerCase()}
          </span>
          <p className={styles.buildsOnText}>{source}</p>
        </div>
      )}
      <label className={styles.fieldLabel} htmlFor={`plan-${step.id}`}>
        {FIELD_NAMES[field]}
        {ON_IDENTITY.has(field) && <span className={styles.fieldShared}>Also on Story Identity</span>}
      </label>
      <textarea
        id={`plan-${step.id}`}
        className={styles.textarea}
        value={value}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        rows={step.rows ?? 4}
        placeholder={step.example}
        autoFocus={!value}
      />
      <div className={styles.fieldFooter}>
        <span className={styles.wordCount}>
          {words} {words === 1 ? "word" : "words"}
        </span>
        {step.guidanceLayer && (
          <AIOnly>
            <button className={styles.guidanceBtn} onClick={() => setGuidance((g) => !g)}>
              <Compass size={13} />
              {guidance ? "Hide guidance" : "Get guidance"}
            </button>
          </AIOnly>
        )}
      </div>
      {guidance && step.guidanceLayer && (
        <PlanGuidance
          storyId={story.id}
          layer={step.guidanceLayer}
          content={value}
          onClose={() => setGuidance(false)}
        />
      )}
    </div>
  );
}
