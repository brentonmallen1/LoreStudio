import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { isStepDone, type PlanMethod } from "../../lib/planning/methods";
import { usePlanData } from "../../lib/planning/usePlanData";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import PageHeader from "../layout/PageHeader";
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
  const { activeStory, setActiveStory } = useStoryStore();
  const { data, method, methods, reloadThreads } = usePlanData();
  // Held in state: the outline lists clear the query string once they have read ?tab=.
  const [view, setView] = useState<View>(() => viewFrom(params));
  const [choosing, setChoosing] = useState(false);

  if (!activeStory || !data) return null;

  function show(next: View) {
    setView(next);
    setParams(next === "method" ? {} : { view: next }, { replace: true });
  }

  async function choose(id: string) {
    // A beat-sheet method is that beat sheet: the scenes' beat pickers and the Story
    // Health beat card follow it.
    const sheet = id.startsWith("beats:") ? id.slice("beats:".length) : null;
    setActiveStory(
      await api.updateStory(storyId, { planning_method: id, ...(sheet ? { beat_sheet_id: sheet } : {}) }),
    );
    setChoosing(false);
  }

  const unsortedCount = (activeStory.idea_fragments ?? []).filter((f) => !f.filed).length;
  const doneCount = method ? method.steps.filter((s) => isStepDone(s, data)).length : 0;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Plan"
        views={[
          { id: "ideas", label: "Ideas", count: unsortedCount },
          { id: "method", label: method ? method.label : "Method" },
          { id: "boards", label: "Beat boards" },
        ]}
        view={view}
        onView={(id) => show(id as View)}
        aside={<AIFeatureInfoTrigger pageId="outline" size="sm" />}
        summary={
          view === "method" && method && !choosing ? (
            <>
              {doneCount} of {method.steps.length} steps done ·{" "}
              <button className={styles.linkBtn} onClick={() => setChoosing(true)}>
                Change method
              </button>
            </>
          ) : view === "ideas" ? (
            "Everything you know, in any order. Sort it into the story when you're ready."
          ) : view === "boards" ? (
            "Loose outlines for brainstorming beats. Turn any beat into a scene."
          ) : undefined
        }
      />

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
          methods={methods}
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
            reloadThreads={reloadThreads}
          />
        </div>
      )}
    </div>
  );
}

function MethodPicker({
  current,
  methods,
  onChoose,
  onIdeas,
  onCancel,
}: {
  current?: PlanMethod;
  methods: PlanMethod[];
  onChoose: (id: string) => void;
  onIdeas: () => void;
  onCancel?: () => void;
}) {
  const beatSheets = methods.filter((m) => m.id.startsWith("beats:"));
  const card = (m: PlanMethod) => (
    <button
      key={m.id}
      className={`${styles.methodCard} ${m.id === current?.id ? styles.methodCardCurrent : ""}`}
      onClick={() => onChoose(m.id)}
    >
      <span className={styles.methodName}>{m.label}</span>
      <span className={styles.methodSummary}>{m.summary}</span>
      <span className={styles.methodStepsPreview}>{m.steps.map((s) => s.label).join(" · ")}</span>
    </button>
  );
  return (
    <div className={styles.body}>
      <div className={styles.picker}>
        <p className={styles.pickerIntro}>
          Pick a way in. Each method asks a few small questions in order; your answers go into the story
          itself (its logline, characters and scenes), so switching methods later keeps everything.
        </p>
        <div className={styles.methodCards}>
          {methods.filter((m) => !m.id.startsWith("beats:")).map(card)}
          <button className={`${styles.methodCard} ${styles.methodCardIdea}`} onClick={onIdeas}>
            <span className={styles.methodName}>Start from an idea</span>
            <span className={styles.methodSummary}>
              Not ready for questions? Write down everything you know, in any order, then sort it into
              characters, places, scenes and questions.
            </span>
            <span className={styles.methodStepsPreview}>Ideas tab · no method needed</span>
          </button>
        </div>
        {beatSheets.length > 0 && (
          <>
            <h3 className={styles.pickerHeading}>Beat sheets</h3>
            <p className={styles.pickerIntro}>
              Walk a beat sheet beat by beat, planning the scene that carries each one. Choosing one also
              makes it the story's beat sheet; ones you make in Story Identity appear here too.
            </p>
            <div className={styles.methodCards}>{beatSheets.map(card)}</div>
          </>
        )}
        {onCancel && (
          <button className={styles.quietBtn} onClick={onCancel}>
            Keep {current?.label}
          </button>
        )}
      </div>
    </div>
  );
}
