import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Orbit } from "lucide-react";
import AIFeatureInfoTrigger from "../components/ai/AIFeatureInfoTrigger";
import PageHeader from "../components/layout/PageHeader";
import OutlineCards from "../components/outliner/OutlineCards";
import OutlineEmpty from "../components/outliner/OutlineEmpty";
import OutlineList from "../components/outliner/OutlineList";
import OutlinePanel from "../components/outliner/OutlinePanel";
import OutlineTimeCards from "../components/outliner/OutlineTimeCards";
import Tray from "../components/outliner/Tray";
import { TrayContext, useTray } from "../components/outliner/useTray";
import { useInPanelPage } from "../components/panel/inPanelPage";
import { useAIAvailable } from "../lib/mode";
import {
  OUTLINE_ORDERS,
  OUTLINE_VIEWS,
  asOrder,
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
const FillTrayPanel = lazy(() => import("../components/outliner/FillTrayPanel"));

/** Below this width the tray folds above the Outline instead of standing beside it. */
const TRAY_BESIDE = 820;

/**
 * Logo menu › Outline (doc 29 D2, D3): what happens, part by part. A real outliner over the
 * story's acts, chapters and scenes, as a List or as Cards (once the Storyboard), each as the
 * reader meets it or as it happens, with the Not placed yet tray of ideas beside it (once the
 * beat boards). Beside the prose it is the same lines, narrow, with the scene being written
 * marked and the tray under them.
 */
export default function OutlinePage({ storyId }: { storyId: string }) {
  const inPanel = useInPanelPage();
  if (inPanel) return <OutlinePanel storyId={storyId} />;
  return <OutlineFull storyId={storyId} />;
}

function OutlineFull({ storyId }: { storyId: string }) {
  const [params, setParams] = useSearchParams();
  const askedView = asView(params.get("view"));
  const askedOrder = asOrder(params.get("order"));
  const [chosen, setChosen] = useState<OutlineView>(loadView);
  const [orderChosen, setOrderState] = useState<OutlineOrder>(loadOrder);
  const [started, setStarted] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const story = useStoryStore((s) => s.activeStory);
  const ai = useAIAvailable();
  const tray = useTray(storyId);
  const shape = shapeOf(template);
  const view = askedView ?? chosen;
  const order = askedOrder ?? orderChosen;
  const scroller = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(scroller, TRAY_BESIDE);
  // The address may ask for a view (the old Storyboard's opens Cards) or an order (the old
  // Timeline's, as it happens): remember them too.
  useEffect(() => {
    if (askedView) saveView(askedView);
    if (askedOrder) saveOrder(askedOrder);
  }, [askedView, askedOrder]);

  function setView(next: string) {
    const v = asView(next) ?? "list";
    setChosen(v);
    saveView(v);
    if (askedView || askedOrder) setParams({}, { replace: true });
  }
  function setOrder(next: OutlineOrder) {
    setOrderState(next);
    saveOrder(next);
    if (askedView || askedOrder) setParams({}, { replace: true });
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
    <OutlineList key={started ?? "list"} storyId={storyId} startAfter={started} />
  );

  return (
    <TrayContext.Provider value={tray}>
      <div className={styles.page}>
        <PageHeader
          title="Outline"
          views={OUTLINE_VIEWS}
          view={view}
          onView={setView}
          summary={blank ? undefined : outlineSummary(structure, shape)}
          aside={ai ? <AIFeatureInfoTrigger pageId="outline" size="sm" /> : undefined}
          more={
            ai
              ? [
                  {
                    label: "Fill the tray from my prose",
                    icon: Orbit,
                    ai: true,
                    onSelect: () => setFilling(true),
                  },
                ]
              : []
          }
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
        <div className={styles.scroll} ref={scroller}>
          <div className={view === "cards" && !blank ? styles.wide : styles.content}>
            <div className={styles.withTray} data-narrow={narrow || undefined}>
              <div className={styles.outlineSide}>{body}</div>
              <Tray tray={tray} fold={narrow} />
            </div>
          </div>
        </div>
        {filling && (
          <Suspense fallback={null}>
            <FillTrayPanel storyId={storyId} onClose={() => setFilling(false)} onKeep={tray.addMany} />
          </Suspense>
        )}
      </div>
    </TrayContext.Provider>
  );
}

/** Whether the element is narrower than a width, following the window and the side panel. */
function useNarrow(ref: React.RefObject<HTMLElement | null>, below: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setNarrow(el.clientWidth > 0 && el.clientWidth < below);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref, below]);
  return narrow;
}
