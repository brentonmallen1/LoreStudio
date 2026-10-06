import { useCallback, useEffect, useMemo, useState } from "react";
import { numbersApi } from "../api/numbers";
import AIFeatureInfoTrigger from "../components/ai/AIFeatureInfoTrigger";
import PageHeader from "../components/layout/PageHeader";
import Dialogue from "../components/numbers/Dialogue";
import Prose from "../components/numbers/Prose";
import Rotation from "../components/numbers/Rotation";
import Cast from "../components/numbers/Cast";
import Pacing from "../components/numbers/Pacing";
import Threads from "../components/numbers/Threads";
import Words from "../components/numbers/Words";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { beatMarks, castGrid, chapterSpans, pacing, threadLanes } from "../lib/numbers/charts";
import { povRotation } from "../lib/numbers/pov";
import { sceneLeaves } from "../lib/planning/methods";
import { useFindingsStore } from "../stores/findingsStore";
import { useStoryStore } from "../stores/storyStore";
import type { StoryNumbers } from "../types/numbers";
import Summaries from "../components/numbers/Summaries";
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
  const reload = useCallback(() => void load(), [load]);
  useReloadOnUndo(["structure_node", "character", "plot_thread"], () => void load());

  const charts = useMemo(() => {
    const scenes = sceneLeaves(structure, activeTemplate);
    const cast = new Map((sceneCast?.scenes ?? []).map((e) => [e.node_id, e]));
    const sheet = beatSheets.find((b) => b.id === activeStory?.beat_sheet_id);
    const rotation = povRotation(scenes, activeStory?.pov_character_id, characters);
    return {
      bars: pacing(scenes, cast),
      beats: sheet ? beatMarks(sheet.beats, scenes) : [],
      lanes: threadLanes(threads, scenes),
      chapters: chapterSpans(structure, scenes),
      cast: castGrid(characters, scenes, cast, 3, rotation.perScene),
      scenes,
      rotation,
    };
  }, [
    structure,
    activeTemplate,
    sceneCast,
    threads,
    characters,
    beatSheets,
    activeStory?.beat_sheet_id,
    activeStory?.pov_character_id,
  ]);

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
        aside={<AIFeatureInfoTrigger pageId="numbers" size="md" />}
        summary={
          <>
            {data ? `${data.words.total.toLocaleString()} words · ${data.words.scenes} scenes` : "Counting…"}
            <span className={styles.stance}>
              The book as it stands, measured: nothing here is a verdict or a suggestion. The ⓘ beside each
              section says what it counts and how to read it.
            </span>
          </>
        }
      />
      <div className={styles.column}>
        {data && (
          <>
            <Words words={data.words} />
            {charts.bars.length > 0 && (
              <>
                <Pacing
                  storyId={storyId}
                  bars={charts.bars}
                  beats={charts.beats}
                  chapters={charts.chapters}
                />
                {charts.lanes.length > 0 && (
                  <Threads
                    storyId={storyId}
                    lanes={charts.lanes}
                    scenes={charts.scenes}
                    chapters={charts.chapters}
                  />
                )}
                {charts.cast.length > 0 && (
                  <Cast cast={charts.cast} scenes={charts.scenes} chapters={charts.chapters} />
                )}
              </>
            )}
            <Rotation
              storyId={storyId}
              scenes={charts.scenes}
              rotation={charts.rotation}
              chapters={charts.chapters}
            />
            <Dialogue storyId={storyId} dialogue={data.dialogue} />
            <Prose prose={data.prose} running={running} onMeasure={() => void measure()} />
            {aiAvailable && s && s.fresh + s.stale + s.missing > 0 && (
              <Summaries storyId={storyId} summaries={s} onDone={reload} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
