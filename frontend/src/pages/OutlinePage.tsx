import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/layout/PageHeader";
import OutlineCards from "../components/outliner/OutlineCards";
import OutlineEmpty from "../components/outliner/OutlineEmpty";
import OutlineList from "../components/outliner/OutlineList";
import OutlinePanel from "../components/outliner/OutlinePanel";
import OutlineTimeCards from "../components/outliner/OutlineTimeCards";
import { useInPanelPage } from "../components/panel/inPanelPage";
import {
  OUTLINE_ORDERS,
  OUTLINE_VIEWS,
  asView,
  loadOrder,
  loadView,
  saveOrder,
  saveView,
  type OutlineOrder,
  type OutlineView,
} from "../lib/outline/prefs";
import { isBlank, outlineSummary, shapeOf } from "../lib/outline/tree";
import { styleOf } from "../lib/workingStyle";
import { useStoryStore } from "../stores/storyStore";
import styles from "../components/outliner/Outline.module.css";

const TimelineView = lazy(() => import("../components/story/TimelineView"));

/**
 * Logo menu › Outline (doc 29 D2): what happens, part by part. A real outliner over the
 * story's acts, chapters and scenes, as a List or as Cards (once the Storyboard), each as the
 * reader meets it or as it happens. Beside the prose it is the same lines, narrow, with the
 * scene being written marked. The strip still widens on the writing page (⌘ palette).
 */
export default function OutlinePage({ storyId }: { storyId: string }) {
  const inPanel = useInPanelPage();
  if (inPanel) return <OutlinePanel storyId={storyId} />;
  return <OutlineFull storyId={storyId} />;
}

function OutlineFull({ storyId }: { storyId: string }) {
  const [params, setParams] = useSearchParams();
  const asked = asView(params.get("view"));
  const [chosen, setChosen] = useState<OutlineView>(loadView);
  const [order, setOrderState] = useState<OutlineOrder>(loadOrder);
  const [started, setStarted] = useState<string | null>(null);
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const story = useStoryStore((s) => s.activeStory);
  const shape = shapeOf(template);
  const view = asked ?? chosen;
  // The address may ask for a view (the old Storyboard's opens Cards): remember it too.
  useEffect(() => {
    if (asked) saveView(asked);
  }, [asked]);

  function setView(next: string) {
    const v = asView(next) ?? "list";
    setChosen(v);
    saveView(v);
    if (asked) setParams({}, { replace: true });
  }
  function setOrder(next: OutlineOrder) {
    setOrderState(next);
    saveOrder(next);
  }

  const blank = !started && isBlank(structure, shape);
  const body = blank ? (
    <OutlineEmpty storyId={storyId} style={styleOf(story)} onStarted={setStarted} />
  ) : view === "cards" ? (
    order === "time" ? (
      <OutlineTimeCards storyId={storyId} />
    ) : (
      <OutlineCards storyId={storyId} />
    )
  ) : order === "time" ? (
    <Suspense fallback={null}>
      <TimelineView storyId={storyId} />
    </Suspense>
  ) : (
    <OutlineList storyId={storyId} startAfter={started} />
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Outline"
        views={OUTLINE_VIEWS}
        view={view}
        onView={setView}
        summary={blank ? undefined : outlineSummary(structure, shape)}
        chips={
          blank ? undefined : (
            <div className={styles.orders} role="group" aria-label="Order">
              {OUTLINE_ORDERS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={order === o.id}
                  onClick={() => setOrder(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )
        }
      />
      <div className={styles.scroll}>
        <div className={view === "cards" && !blank ? styles.wide : styles.content}>{body}</div>
      </div>
    </div>
  );
}
