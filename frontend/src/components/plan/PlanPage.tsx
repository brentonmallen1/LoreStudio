import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { isStepDone, nextStep, type PlanMethod } from "../../lib/planning/methods";
import { inPatternOrder } from "../../lib/patterns";
import { usePlanData } from "../../lib/planning/usePlanData";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import TermText from "../common/TermText";
import PageHeader from "../layout/PageHeader";
import BookInSeriesLine from "../series/plan/BookInSeriesLine";
import MethodSteps from "./MethodSteps";
import styles from "./Plan.module.css";

/**
 * Logo menu › Plan with questions (doc 29 D4, B-GuidedPlanning): guided questions that fill
 * your Outline. A way in walks the writer through the story's foundations one small question
 * at a time; every answer goes into the story itself (Story identity, the character sheets,
 * the Outline's scenes), so nothing is written twice and switching ways loses nothing. Each
 * way has a plain name; the name it is known by is small print. The beat boards and the
 * Timeline that once sat here are the Outline's tray and its "As it happens" now; their old
 * addresses go there.
 */
export default function PlanPage({ storyId }: { storyId: string }) {
  const [params, setParams] = useSearchParams();
  const { activeStory, setActiveStory } = useStoryStore();
  const { data, method, methods, reloadThreads } = usePlanData();
  const [choosing, setChoosing] = useState(false);

  if (params.has("tab") || params.get("view") === "boards")
    return <Navigate to={`/stories/${storyId}/outline`} replace />;
  if (params.get("view") === "timeline")
    return <Navigate to={`/stories/${storyId}/outline?order=time`} replace />;
  if (!activeStory || !data) return null;

  async function choose(id: string) {
    // A classic pattern's walk is that pattern: the Outline's overlay, the scenes' moment
    // pickers and the Story Health card follow it.
    const sheet = id.startsWith("beats:") ? id.slice("beats:".length) : null;
    setActiveStory(
      await api.updateStory(storyId, { planning_method: id, ...(sheet ? { beat_sheet_id: sheet } : {}) }),
    );
    setChoosing(false);
  }

  const doneCount = method ? method.steps.filter((s) => isStepDone(s, data)).length : 0;
  const open = method ? nextStep(method, data) : null;
  const stepAt = method ? (open ? method.steps.indexOf(open) + 1 : method.steps.length) : 0;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Plan with questions"
        aside={<AIFeatureInfoTrigger pageId="outline" size="sm" />}
        summary={
          method && !choosing ? (
            <>
              {method.label} · {doneCount} of {method.steps.length} steps done ·{" "}
              <button className={styles.linkBtn} onClick={() => setChoosing(true)}>
                Pick another way in
              </button>
            </>
          ) : undefined
        }
      />
      <BookInSeriesLine storyId={storyId} />
      <div className={styles.body}>
        {!method || choosing ? (
          <WayPicker
            storyId={storyId}
            current={method}
            stepAt={stepAt}
            methods={methods}
            onChoose={choose}
            onCancel={method ? () => setChoosing(false) : undefined}
          />
        ) : (
          <MethodSteps
            key={method.id}
            method={method}
            data={data}
            initialStep={params.get("step")}
            onStepChange={(step) => setParams({ step }, { replace: true })}
            reloadThreads={reloadThreads}
          />
        )}
      </div>
    </div>
  );
}

/** The ways in, in plain words, each with a rough time and the name it is known by. */
function WayPicker({
  storyId,
  current,
  stepAt,
  methods,
  onChoose,
  onCancel,
}: {
  storyId: string;
  current?: PlanMethod;
  /** Where the writer is in the current way: its first step not done. */
  stepAt: number;
  methods: PlanMethod[];
  onChoose: (id: string) => void;
  onCancel?: () => void;
}) {
  const patterns = inPatternOrder(
    methods.filter((m) => m.id.startsWith("beats:")).map((m) => ({ id: m.id.slice(6), name: m.label, m })),
  ).map((p) => p.m);
  const onPattern = !!current?.id.startsWith("beats:");
  const [showPatterns, setShowPatterns] = useState(onPattern);
  const where = (m: PlanMethod) =>
    m.id === current?.id ? (
      <span className={styles.wayWhere}>
        You're on step {stepAt} of {m.steps.length}
      </span>
    ) : null;

  const card = (m: PlanMethod) => (
    <button
      key={m.id}
      type="button"
      className={`${styles.methodCard} ${m.id === current?.id ? styles.methodCardCurrent : ""}`}
      aria-current={m.id === current?.id ? "true" : undefined}
      onClick={() => onChoose(m.id)}
    >
      <span className={styles.wayHead}>
        <span className={styles.methodName}>{m.label}</span>
        {m.time && <span className={styles.wayTime}>{m.time}</span>}
      </span>
      <span className={styles.methodSummary}>
        <TermText text={m.summary} />
      </span>
      {where(m)}
      {m.knownAs && (
        <span className={styles.methodStepsPreview}>
          <TermText text={m.knownAs} />
        </span>
      )}
    </button>
  );

  return (
    <div className={styles.picker}>
      <p className={styles.pickerIntro}>
        Not sure where to begin? Answer a few small questions. Your answers go straight into the Outline and
        Story identity, so nothing is written twice.
      </p>
      <h2 className={styles.pickerHeading}>Pick a way in</h2>
      <div className={styles.ways}>
        {methods.filter((m) => !m.id.startsWith("beats:")).map(card)}
        {patterns.length > 0 && (
          <div className={styles.wayGroup}>
            <button
              type="button"
              className={`${styles.methodCard} ${onPattern ? styles.methodCardCurrent : ""}`}
              aria-expanded={showPatterns}
              onClick={() => setShowPatterns(!showPatterns)}
            >
              <span className={styles.wayHead}>
                <span className={styles.methodName}>Follow a classic pattern</span>
                <span className={styles.wayTime}>
                  {patterns.length} pattern{patterns.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className={styles.methodSummary}>
                Well-known shapes, like the hero's journey or Save the Cat, that say what tends to happen and
                roughly when. You plan a scene for each moment.
              </span>
              {onPattern && current && where(current)}
            </button>
            {showPatterns && <div className={styles.wayPatterns}>{patterns.map(card)}</div>}
          </div>
        )}
      </div>
      <p className={styles.rather}>
        Rather just write? <Link to={`/stories/${storyId}/write`}>Open a blank page</Link>, or empty your head
        on <Link to={`/stories/${storyId}/freewrite`}>Freewrite</Link> first.
      </p>
      {onCancel && current && (
        <button type="button" className={styles.keepBtn} onClick={onCancel}>
          Keep {current.label}
        </button>
      )}
    </div>
  );
}
