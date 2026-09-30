import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import {
  PLAN_METHODS,
  isStepDone,
  methodById,
  sceneLeaves,
  type PlanData,
  type PlanMethod,
} from "../../lib/planning/methods";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import MethodSteps from "./MethodSteps";
import IdeaView from "./IdeaView";
import styles from "./Plan.module.css";

const OutlineManager = lazy(() => import("../outline/OutlineManager"));

type View = "ideas" | "method" | "boards";

function viewFrom(params: URLSearchParams): View {
  if (params.has("tab") || params.get("view") === "boards") return "boards";
  return params.get("view") === "ideas" ? "ideas" : "method";
}

/**
 * The Plan page (refactor doc 10). A method walks the author through the story's
 * foundations one small step at a time; every step writes the same shared fields, so the
 * answers show up on Story Identity, the character sheets and the structure tree.
 * Beat boards are the free-form outline lists, for brainstorming beats loosely.
 */
export default function PlanPage({ storyId }: { storyId: string }) {
  const [params, setParams] = useSearchParams();
  const { activeStory, setActiveStory, characters, structure, activeTemplate } = useStoryStore();
  // Held in state: the outline lists clear the query string once they have read ?tab=.
  const [view, setView] = useState<View>(() => viewFrom(params));
  const [choosing, setChoosing] = useState(false);

  if (!activeStory) return null;
  const method = methodById(activeStory.planning_method);
  const data: PlanData = { story: activeStory, characters, scenes: sceneLeaves(structure, activeTemplate) };

  function show(next: View) {
    setView(next);
    setParams(next === "method" ? {} : { view: next }, { replace: true });
  }

  async function choose(id: string) {
    setActiveStory(await api.updateStory(storyId, { planning_method: id }));
    setChoosing(false);
  }

  const unsortedCount = (activeStory.idea_fragments ?? []).filter((f) => !f.filed).length;
  const doneCount = method ? method.steps.filter((s) => isStepDone(s, data)).length : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Plan</h2>
          <div className={styles.tabs} role="tablist" aria-label="Plan views">
            <button
              role="tab"
              aria-selected={view === "ideas"}
              className={`${styles.tab} ${view === "ideas" ? styles.tabActive : ""}`}
              onClick={() => show("ideas")}
            >
              Ideas
              {unsortedCount > 0 && <span className={styles.tabCount}>{unsortedCount}</span>}
            </button>
            <button
              role="tab"
              aria-selected={view === "method"}
              className={`${styles.tab} ${view === "method" ? styles.tabActive : ""}`}
              onClick={() => show("method")}
            >
              {method ? method.label : "Method"}
            </button>
            <button
              role="tab"
              aria-selected={view === "boards"}
              className={`${styles.tab} ${view === "boards" ? styles.tabActive : ""}`}
              onClick={() => show("boards")}
            >
              Beat boards
            </button>
          </div>
          <AIFeatureInfoTrigger pageId="outline" size="sm" />
        </div>
        {view === "method" && method && !choosing && (
          <p className={styles.subtitle}>
            {doneCount} of {method.steps.length} steps done ·{" "}
            <button className={styles.linkBtn} onClick={() => setChoosing(true)}>
              Change method
            </button>
          </p>
        )}
        {view === "ideas" && (
          <p className={styles.subtitle}>
            Everything you know, in any order. Sort it into the story when you're ready.
          </p>
        )}
        {view === "boards" && (
          <p className={styles.subtitle}>
            Loose outlines for brainstorming beats. Turn any beat into a scene.
          </p>
        )}
      </header>

      {view === "ideas" ? (
        <div className={styles.body}>
          <IdeaView storyId={storyId} />
        </div>
      ) : view === "boards" ? (
        <Suspense fallback={null}>
          <OutlineManager storyId={storyId} />
        </Suspense>
      ) : !method || choosing ? (
        <MethodPicker
          current={method}
          onChoose={choose}
          onIdeas={() => show("ideas")}
          onCancel={method ? () => setChoosing(false) : undefined}
        />
      ) : (
        <div className={styles.body}>
          <MethodSteps
            key={method.id}
            method={method}
            data={data}
            initialStep={params.get("step")}
            onStepChange={(step) => setParams({ step }, { replace: true })}
          />
        </div>
      )}
    </div>
  );
}

function MethodPicker({
  current,
  onChoose,
  onIdeas,
  onCancel,
}: {
  current?: PlanMethod;
  onChoose: (id: string) => void;
  onIdeas: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className={styles.body}>
      <div className={styles.picker}>
        <p className={styles.pickerIntro}>
          Pick a way in. Each method asks a few small questions in order; your answers go into the story
          itself (its logline, characters and scenes), so switching methods later keeps everything.
        </p>
        <div className={styles.methodCards}>
          {PLAN_METHODS.map((m) => (
            <button
              key={m.id}
              className={`${styles.methodCard} ${m.id === current?.id ? styles.methodCardCurrent : ""}`}
              onClick={() => onChoose(m.id)}
            >
              <span className={styles.methodName}>{m.label}</span>
              <span className={styles.methodSummary}>{m.summary}</span>
              <span className={styles.methodStepsPreview}>{m.steps.map((s) => s.label).join(" · ")}</span>
            </button>
          ))}
          <button className={`${styles.methodCard} ${styles.methodCardIdea}`} onClick={onIdeas}>
            <span className={styles.methodName}>Start from an idea</span>
            <span className={styles.methodSummary}>
              Not ready for questions? Write down everything you know, in any order, then sort it into
              characters, places, scenes and questions.
            </span>
            <span className={styles.methodStepsPreview}>Ideas tab · no method needed</span>
          </button>
        </div>
        {onCancel && (
          <button className={styles.quietBtn} onClick={onCancel}>
            Keep {current?.label}
          </button>
        )}
      </div>
    </div>
  );
}
