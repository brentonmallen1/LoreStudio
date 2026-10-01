import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { numbersApi } from "../api/numbers";
import PageHeader from "../components/layout/PageHeader";
import Dialogue from "../components/numbers/Dialogue";
import Prose from "../components/numbers/Prose";
import Score from "../components/numbers/Score";
import Words from "../components/numbers/Words";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { beatMarks, castGrid, pacing, threadLanes } from "../lib/numbers/charts";
import { sceneLeaves } from "../lib/planning/methods";
import { useFindingsStore } from "../stores/findingsStore";
import { useStoryStore } from "../stores/storyStore";
import type { StoryNumbers } from "../types/numbers";
import styles from "../components/numbers/Numbers.module.css";

/**
 * The story in numbers (doc 13 P3, D5): what Story Health measured, on a page of its own.
 * Words and their state, pacing, threads, who is on the page, dialogue and prose habits.
 * Nothing here is a verdict; Findings says what needs the author's eye.
 */
export default function NumbersPage({ storyId }: { storyId: string }) {
  const [data, setData] = useState<StoryNumbers | null>(null);
  const [running, setRunning] = useState(false);
  const { structure, activeTemplate, sceneCast, threads, characters, beatSheets, activeStory } =
    useStoryStore();
  const runLocal = useFindingsStore((s) => s.runLocal);
  const aiAvailable = useAIAvailable();

  const load = useCallback(
    () =>
      numbersApi
        .get(storyId)
        .then(setData)
        .catch(() => setData(null)),
    [storyId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useReloadOnUndo(["structure_node", "character", "plot_thread"], () => void load());

  const charts = useMemo(() => {
    const scenes = sceneLeaves(structure, activeTemplate);
    const cast = new Map((sceneCast?.scenes ?? []).map((e) => [e.node_id, e]));
    const sheet = beatSheets.find((b) => b.id === activeStory?.beat_sheet_id);
    return {
      bars: pacing(scenes, cast),
      beats: sheet ? beatMarks(sheet.beats, scenes) : [],
      lanes: threadLanes(threads, scenes, cast),
      cast: castGrid(characters, scenes, cast),
    };
  }, [structure, activeTemplate, sceneCast, threads, characters, beatSheets, activeStory?.beat_sheet_id]);

  async function measure() {
    setRunning(true);
    try {
      await runLocal();
      await load();
    } finally {
      setRunning(false);
    }
  }

  const s = data?.summaries;
  return (
    <div className={styles.page}>
      <PageHeader
        title="The story in numbers"
        summary={
          data ? `${data.words.total.toLocaleString()} words · ${data.words.scenes} scenes` : "Counting…"
        }
      />
      <div className={styles.column}>
        {data && (
          <>
            <Words words={data.words} />
            {charts.bars.length > 0 && <Score storyId={storyId} {...charts} />}
            <Dialogue storyId={storyId} dialogue={data.dialogue} />
            <Prose prose={data.prose} running={running} onMeasure={() => void measure()} />
            {aiAvailable && s && s.fresh + s.stale + s.missing > 0 && (
              <section className={styles.section} aria-labelledby="numbers-summaries">
                <h2 className={styles.heading} id="numbers-summaries">
                  Scene summaries
                </h2>
                <p className={styles.lede}>
                  The Assistant&rsquo;s short summaries of each scene: {s.fresh} up to date, {s.stale} written
                  before the scene last changed, {s.missing} not written yet. They are refreshed from{" "}
                  <Link to={`/stories/${storyId}/findings`}>Findings</Link>.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
