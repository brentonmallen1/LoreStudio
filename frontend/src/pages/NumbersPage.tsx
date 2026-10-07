import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Gauge } from "lucide-react";
import { api } from "../api/client";
import { numbersApi } from "../api/numbers";
import AIFeatureInfoTrigger from "../components/ai/AIFeatureInfoTrigger";
import { Modal } from "../components/common";
import PageHeader from "../components/layout/PageHeader";
import Cast from "../components/numbers/Cast";
import ComparePicker from "../components/numbers/ComparePicker";
import { CompareBar, WhatChanged } from "../components/numbers/CompareSummary";
import Dialogue from "../components/numbers/Dialogue";
import Pacing from "../components/numbers/Pacing";
import Prose from "../components/numbers/Prose";
import Rotation from "../components/numbers/Rotation";
import Summaries from "../components/numbers/Summaries";
import Talk from "../components/numbers/Talk";
import Threads from "../components/numbers/Threads";
import Trend from "../components/numbers/Trend";
import Words from "../components/numbers/Words";
import { useNumbersCompare } from "../hooks/useNumbersCompare";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { liveFigures, readingFigures } from "../lib/numbers/figures";
import { useFindingsStore } from "../stores/findingsStore";
import { useStoryStore } from "../stores/storyStore";
import { toast } from "../stores/toastStore";
import type { StoryNumbers } from "../types/numbers";
import styles from "../components/numbers/Numbers.module.css";

/**
 * The story in numbers (doc 13 P3, D5): what Story Health measured, on a page of its own.
 * Words and their state, pacing, threads, who is on the page, dialogue and prose habits.
 * Nothing here is a verdict; Findings says what needs the author's eye. Compare ▾ (doc 19)
 * draws any earlier reading behind the book as it is, or two readings against each other.
 */
export default function NumbersPage({ storyId }: { storyId: string }) {
  const [data, setData] = useState<StoryNumbers | null>(null);
  const [running, setRunning] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const { structure, activeTemplate, sceneCast, threads, characters, beatSheets, activeStory } =
    useStoryStore();
  const runLocal = useFindingsStore((s) => s.runLocal);
  const findings = useFindingsStore((s) => s.data?.counts_by_kind ?? null);
  const aiAvailable = useAIAvailable();
  const compare = useNumbersCompare(storyId);

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

  const live = useMemo(
    () =>
      data
        ? liveFigures(data, {
            structure,
            activeTemplate,
            sceneCast,
            threads,
            characters,
            beatSheets,
            beatSheetId: activeStory?.beat_sheet_id,
            storyPov: activeStory?.pov_character_id,
            findings: findings as Record<string, number> | null,
          })
        : null,
    [data, structure, activeTemplate, sceneCast, threads, characters, beatSheets, activeStory, findings],
  );
  const toFigures = useMemo(() => (compare.to ? readingFigures(compare.to.data) : null), [compare.to]);
  const then = useMemo(() => (compare.from ? readingFigures(compare.from.data) : null), [compare.from]);
  // The side drawn in full: the book as it is, or the later reading of two.
  const now = toFigures ?? live;

  async function measure() {
    setRunning(true);
    try {
      await runLocal();
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function saveVersion(name: string) {
    setNaming(null);
    try {
      await api.createSnapshot(storyId, name.trim() || undefined);
      toast.success(name.trim() ? `Version “${name.trim()}” saved` : "Version saved");
      window.setTimeout(() => void compare.reload(), 1500);
    } catch {
      toast.error("The version could not be saved");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="The story in numbers"
        aside={
          <>
            <ComparePicker compare={compare} />
            <AIFeatureInfoTrigger pageId="numbers" size="md" />
          </>
        }
        more={[
          {
            label: "Measure now",
            icon: Gauge,
            onSelect: () =>
              void compare.measureNow().then(
                () => toast.success("Measured: the reading is in Compare"),
                () => toast.error("The numbers could not be measured"),
              ),
          },
          { label: "Save a version…", icon: Bookmark, onSelect: () => setNaming("") },
        ]}
        summary={
          <>
            {now ? `${now.words.total.toLocaleString()} words · ${now.words.scenes} scenes` : "Counting…"}
            <span className={styles.stance}>
              The book as it stands, measured: nothing here is a verdict or a suggestion. The ⓘ beside each
              section says what it counts and how to read it.
            </span>
          </>
        }
        chips={compare.from ? <CompareBar compare={compare} /> : undefined}
      />
      <div className={styles.column}>
        {live && <Trend compare={compare} now={compare.to ? null : live} />}
        {now && then && <WhatChanged then={then} now={now} />}
        {now && (
          <>
            <Words words={now.words} then={then?.words} />
            {now.bars.length > 0 && (
              <>
                <Pacing storyId={storyId} now={now} then={then} />
                {now.lanes.length > 0 && <Threads storyId={storyId} now={now} then={then} />}
                {now.cast.length > 0 && <Cast now={now} then={then} />}
              </>
            )}
            <Rotation storyId={storyId} now={now} then={then} />
            <Dialogue storyId={storyId} dialogue={now.dialogue} then={then} />
            {/* The book as it is: not kept in readings yet (doc 20 P7). */}
            {!compare.to && <Talk storyId={storyId} now={now} />}
            <Prose
              prose={now.prose}
              then={then ? then.prose : undefined}
              running={running}
              onMeasure={() => void measure()}
            />
            {aiAvailable && now.summaries.fresh + now.summaries.stale + now.summaries.missing > 0 && (
              <Summaries
                storyId={storyId}
                summaries={now.summaries}
                then={then?.summaries}
                live={!compare.to}
                onDone={reload}
              />
            )}
          </>
        )}
      </div>
      <Modal
        isOpen={naming !== null}
        onClose={() => setNaming(null)}
        title="Save a version"
        icon={<Bookmark size={15} />}
        size="sm"
        footer={
          <button type="button" className={styles.verbPlain} onClick={() => void saveVersion(naming ?? "")}>
            Save
          </button>
        }
      >
        <form
          className={styles.nameForm}
          onSubmit={(e) => {
            e.preventDefault();
            void saveVersion(naming ?? "");
          }}
        >
          <label>
            Name
            <input
              autoFocus
              value={naming ?? ""}
              placeholder="e.g. Draft 1, Before the revision"
              onChange={(e) => setNaming(e.target.value)}
            />
          </label>
          <p>
            A snapshot of the story, kept in Chronicle › Versions, with its numbers. Compare lists it by name.
          </p>
        </form>
      </Modal>
    </div>
  );
}
