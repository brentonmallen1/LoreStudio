import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { api } from "../../api/client";
import { seriesApi, type CarryCandidate } from "../../api/series";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import CarryOverStep from "../series/CarryOverStep";
import { carryItem, carryKey } from "../../lib/series/carry";
import { sequelCandidates } from "../../lib/series/sequelOf";
import { DEFAULT_TEMPLATE, formatOf, templatesFor } from "../../lib/storyFormat";
import { landingPath, styleOf } from "../../lib/workingStyle";
import type { StoryFormat, StoryStructureTemplate, WorkingStyle } from "../../types";
import TemplateManagerDialog from "../templates/TemplateManagerDialog";
import { Modal } from "../common";
import NewStoryMore from "./NewStoryMore";
import { HowYouWork, WhatYouWrite } from "./NewStoryStyle";
import styles from "./CreateStoryDialog.module.css";

interface Props {
  onClose: () => void;
  /** Open as the next book after this story (the "Write a sequel" and "New book" doors). */
  sequelTo?: string;
}

/**
 * A new story, or the next book of a series (series doc), in plain words (doc 29 P1): what it
 * is called, what it is, and how the writer likes to work, which decides where it opens (a
 * planner in the Outline, a discovery writer in the first scene, anyone else on the
 * Overview). The shape, a line about it and the series fold under "More options". "A sequel
 * to…" makes it the book after the one chosen, made a series now if it is not one yet, and a
 * second step asks who carries over. Every door to a new book opens this one dialog.
 */
export default function CreateStoryDialog({ onClose, sequelTo }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formatChoice, setFormat] = useState<StoryFormat>("prose");
  // Left unchosen, a sequel is laid out like the book before it.
  const [templateChoice, setTemplateId] = useState<string | null>(null);
  const [scaffold, setScaffold] = useState(true);
  // Left unchosen, a sequel is worked on as the book before it was.
  const [styleChoice, setStyle] = useState<WorkingStyle | null>(null);
  const [firstStory, setFirstStory] = useState(false);
  const [templates, setTemplates] = useState<StoryStructureTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const { stories, setStories, upsertStory } = useStoryStore();
  const navigate = useNavigate();
  // The next book of a series: the one before it, its series if any, and who carries over.
  const [sequelOf, setSequelOf] = useState(sequelTo ?? "");
  const [step, setStep] = useState<"book" | "carry">("book");
  // What was read for which book: a change of book shows nothing until its own answer comes.
  const [carry, setCarry] = useState<{ of: string; list: CarryCandidate[] } | null>(null);
  const [seriesOfBook, setSeriesOfBook] = useState<{ of: string; name: string | null } | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [seriesName, setSeriesName] = useState("");
  // Known from the start to be the first of several (series v2): the series is made with it.
  const [firstOfSeries, setFirstOfSeries] = useState(false);
  const previous = stories.find((s) => s.id === sequelOf) ?? null;
  const candidates = carry && carry.of === sequelOf ? carry.list : null;
  const seriesOf = seriesOfBook && seriesOfBook.of === sequelOf ? seriesOfBook.name : null;
  // A sequel is written as the book before it was; the server carries the format over.
  const format = previous ? formatOf(previous) : formatChoice;
  const templateId = templateChoice ?? previous?.structure_template_id ?? DEFAULT_TEMPLATE[format];
  const style: WorkingStyle = styleChoice ?? (styleOf(previous) || "discover");

  useEffect(() => {
    api.listStructureTemplates().then(setTemplates).catch(console.error);
    if (useStoryStore.getState().stories.length === 0)
      api
        .listStories()
        .then(setStories)
        .catch(() => {});
  }, [setStories]);

  useEffect(() => {
    if (!sequelOf) return;
    seriesApi
      .carryOver(sequelOf)
      .then((list) => {
        setCarry({ of: sequelOf, list });
        setChosen(new Set(list.filter((c) => c.preselect).map(carryKey)));
      })
      .catch(() => setCarry({ of: sequelOf, list: [] }));
    seriesApi
      .forStory(sequelOf)
      .then((o) => setSeriesOfBook({ of: sequelOf, name: o.series?.name ?? null }))
      .catch(() => {});
  }, [sequelOf]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (previous && step === "book") {
      setStep("carry");
      return;
    }
    setLoading(true);
    try {
      const story = previous
        ? await seriesApi.sequel(previous.id, {
            title: title.trim(),
            description,
            structure_template_id: templateId,
            scaffold,
            carry: (candidates ?? []).filter((c) => chosen.has(carryKey(c))).map(carryItem),
            series_name: seriesOf ? undefined : seriesName.trim() || undefined,
            working_style: style,
          })
        : await api.createStory({
            title: title.trim(),
            description,
            structure_template_id: templateId,
            story_format: format,
            working_style: style,
            scaffold,
          });
      upsertStory(story);
      if (!previous && firstOfSeries)
        await seriesApi
          .create({ name: seriesName.trim() || title.trim(), story_ids: [story.id] })
          .catch(() =>
            toast.error("The story was made, but its series could not be: start it from its Lorebook."),
          );
      navigate(landingPath(story.id, styleOf(story) || style, story.start_node_id, offerFirst && firstStory));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The story could not be made.");
    } finally {
      setLoading(false);
    }
  }

  const offered = templatesFor(templates, format);
  // The First story guide is written for prose, and for a book of its own.
  const offerFirst = !previous && format === "prose";

  const carrying = previous !== null && step === "carry";
  const footer = (
    <>
      <button type="button" onClick={carrying ? () => setStep("book") : onClose} className={styles.cancelBtn}>
        {carrying ? "Back" : "Cancel"}
      </button>
      <button
        type="submit"
        form="create-story-form"
        disabled={loading || !title.trim() || (carrying && candidates === null)}
        className={styles.submitBtn}
      >
        {loading
          ? "Creating…"
          : previous
            ? carrying
              ? "Create the book"
              : "Next: who carries over"
            : offerFirst && firstStory
              ? "Start the guide"
              : style === "plan"
                ? "Start planning"
                : "Start writing"}
      </button>
    </>
  );

  return (
    <>
      {showTemplateManager && (
        <TemplateManagerDialog
          onClose={() => setShowTemplateManager(false)}
          onTemplatesChanged={() =>
            api
              .listStructureTemplates()
              .then(setTemplates)
              .catch(() => {})
          }
        />
      )}
      <Modal
        isOpen
        onClose={onClose}
        title={previous ? `The book after “${previous.title}”` : "A new story"}
        icon={<BookOpen size={15} />}
        size="md"
        footer={footer}
      >
        <form id="create-story-form" onSubmit={handleSubmit} className={styles.form}>
          {carrying ? (
            <CarryOverStep
              previousTitle={previous.title}
              candidates={candidates}
              chosen={chosen}
              onChange={setChosen}
            />
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.question} htmlFor="new-story-title">
                  What's it called?
                </label>
                <input
                  id="new-story-title"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={styles.input}
                />
                <span className={styles.questionHint}>
                  A working title is fine. You can change it whenever you like.
                </span>
              </div>

              {!previous && (
                <WhatYouWrite
                  format={format}
                  onChange={(f: StoryFormat) => {
                    setFormat(f);
                    setTemplateId(null);
                  }}
                />
              )}

              <HowYouWork
                style={style}
                onChange={setStyle}
                offerFirstStory={offerFirst}
                firstStory={firstStory}
                onFirstStory={setFirstStory}
              />

              <NewStoryMore
                offered={offered}
                templateId={templateId}
                onTemplate={setTemplateId}
                scaffold={scaffold}
                onScaffold={setScaffold}
                description={description}
                onDescription={setDescription}
                onManage={() => setShowTemplateManager(true)}
                defaultOpen={!!sequelTo}
                series={{
                  candidates: sequelCandidates(stories),
                  sequelOf,
                  setSequelOf,
                  previous,
                  seriesOf,
                  firstOfSeries,
                  setFirstOfSeries,
                  seriesName,
                  setSeriesName,
                  title,
                }}
              />
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
