import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Clapperboard } from "lucide-react";
import { adaptationApi } from "../../api/adaptation";
import { api } from "../../api/client";
import { seriesApi, type CarryCandidate } from "../../api/series";
import { carryItem, carryKey } from "../../lib/series/carry";
import { FORMATS } from "../../lib/storyFormat";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { StoryFormat } from "../../types";
import CarryOverStep from "../series/CarryOverStep";
import { Modal } from "../common";
import styles from "./CreateStoryDialog.module.css";

const DEFAULT_TITLE: Partial<Record<StoryFormat, string>> = {
  screenplay: "{title}: The Screenplay",
  stage_play: "{title}: A Play",
};

/**
 * "Adapt as a screenplay or a play" (doc 25, P10): a new script after the novel in its series,
 * with the novel's outline and its Lorebook shared. Nothing of the novel is converted; its prose
 * sits beside each scene in the side panel's The novel, for the author to write from.
 */
export default function AdaptDialog({ novelId, onClose }: { novelId: string; onClose: () => void }) {
  const { stories, setStories, upsertStory } = useStoryStore();
  const navigate = useNavigate();
  const novel = stories.find((s) => s.id === novelId) ?? null;
  const [format, setFormat] = useState<StoryFormat>("screenplay");
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<"script" | "carry">("script");
  const [candidates, setCandidates] = useState<CarryCandidate[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [seriesOf, setSeriesOf] = useState<string | null>(null);
  const [seriesName, setSeriesName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (useStoryStore.getState().stories.length === 0)
      api
        .listStories()
        .then(setStories)
        .catch(() => {});
    adaptationApi
      .carry(novelId)
      .then((list) => {
        setCandidates(list);
        setChosen(new Set(list.filter((c) => c.preselect).map(carryKey)));
      })
      .catch(() => setCandidates([]));
    seriesApi
      .forStory(novelId)
      .then((o) => setSeriesOf(o.series?.name ?? null))
      .catch(() => {});
  }, [novelId, setStories]);

  const fallback = (DEFAULT_TITLE[format] ?? "{title}").replace("{title}", novel?.title ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === "script") {
      setStep("carry");
      return;
    }
    setLoading(true);
    try {
      const story = await adaptationApi.adapt(novelId, {
        story_format: format,
        title: title.trim() || undefined,
        carry: (candidates ?? []).filter((c) => chosen.has(carryKey(c))).map(carryItem),
        series_name: seriesOf ? undefined : seriesName.trim() || undefined,
      });
      upsertStory(story);
      // The new script opens with the novel's version of its first scene beside it: the panel
      // shows what was saved for the story when it loads, so that is where it is said.
      try {
        localStorage.setItem(`ls_panel:${story.id}`, JSON.stringify({ tabs: [], showing: "tool:novel" }));
      } catch {
        // Site data blocked: the script opens on This scene, and The novel is on the rail.
      }
      navigate(
        story.start_node_id
          ? `/stories/${story.id}/write?node=${story.start_node_id}`
          : `/stories/${story.id}`,
      );
      usePanelStore.getState().setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The adaptation could not be made.");
    } finally {
      setLoading(false);
    }
  }

  const carrying = step === "carry";
  const footer = (
    <>
      <button
        type="button"
        onClick={carrying ? () => setStep("script") : onClose}
        className={styles.cancelBtn}
      >
        {carrying ? "Back" : "Cancel"}
      </button>
      <button
        type="submit"
        form="adapt-form"
        disabled={loading || !novel || (carrying && candidates === null)}
        className={styles.submitBtn}
      >
        {loading ? "Adapting…" : carrying ? "Make the script" : "Next: the Lorebook"}
      </button>
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={novel ? `Adapt “${novel.title}”` : "Adapt a novel"}
      icon={<Clapperboard size={15} />}
      size="sm"
      footer={footer}
    >
      <form id="adapt-form" onSubmit={handleSubmit} className={styles.form}>
        {carrying ? (
          <CarryOverStep
            previousTitle={novel?.title ?? "the novel"}
            candidates={candidates}
            chosen={chosen}
            onChange={setChosen}
            lead={`The script tells the same story, so everything in “${novel?.title ?? "the novel"}” comes ticked. Each one is shared with the series: the novel and the script keep one canon, and a change to a character in one shows in the other. Untick what the script leaves out.`}
          />
        ) : (
          <>
            <fieldset className={styles.begin}>
              <legend className={styles.label}>Written as</legend>
              {FORMATS.filter((f) => f.id !== "prose").map((f) => (
                <label
                  key={f.id}
                  className={`${styles.beginOption} ${format === f.id ? styles.beginChosen : ""}`}
                >
                  <input
                    type="radio"
                    name="adapt-format"
                    value={f.id}
                    checked={format === f.id}
                    onChange={() => setFormat(f.id)}
                  />
                  <span>
                    <span className={styles.beginName}>{f.label}</span>
                    <span className={styles.beginHint}>{f.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="adapt-title">
                Title
              </label>
              <input
                id="adapt-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={fallback}
                className={styles.input}
              />
            </div>
            {novel && !seriesOf && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="adapt-series">
                  The series is called
                </label>
                <input
                  id="adapt-series"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder={novel.title}
                  className={styles.input}
                />
              </div>
            )}
            <p className={styles.templateHint}>
              {seriesOf
                ? `The script comes after the novel in ${seriesOf}`
                : "The novel and the script become a series"}
              , sharing its Lorebook. It starts with the novel’s outline: every part and scene with its plan
              and its places, each scene opening on its heading. Nothing of the novel is converted: its prose
              is beside each scene under The novel in the side panel, for you to write from. The title page
              says it is based on the novel.
            </p>
          </>
        )}
      </form>
    </Modal>
  );
}
