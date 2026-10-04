import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Settings2 } from "lucide-react";
import { api } from "../../api/client";
import { seriesApi, type CarryCandidate } from "../../api/series";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import CarryOverStep from "../series/CarryOverStep";
import { carryItem, carryKey } from "../../lib/series/carry";
import type { StoryStructureTemplate } from "../../types";
import TemplateManagerDialog from "../templates/TemplateManagerDialog";
import { Modal } from "../common";
import styles from "./CreateStoryDialog.module.css";

type Begin = "write" | "idea" | "plan" | "first";

/** Four ways in (refactor doc 10 P7, doc 18 C10); none is a gate, and writing stays one click away. */
const BEGINNINGS: { id: Begin; label: string; hint: string }[] = [
  {
    id: "first",
    label: "My first story",
    hint: "Seven short steps, from an idea to the first scene. Each says what it becomes.",
  },
  { id: "write", label: "Just write", hint: "Open the first scene and start typing." },
  { id: "idea", label: "Start from an idea", hint: "Write down what you know, then sort it into the story." },
  {
    id: "plan",
    label: "Plan it out",
    hint: "A few small questions in order: a sentence, who wants what, the scenes.",
  },
];

interface Props {
  onClose: () => void;
  /** Open as the next book after this story (the "Write a sequel" and "New book" doors). */
  sequelTo?: string;
}

/**
 * A new story, or the next book of a series (series doc): "A sequel to…" makes it the book
 * after the one chosen, made a series now if it is not one yet, and a second step asks who
 * carries over. Every door to a new book opens this one dialog.
 */
export default function CreateStoryDialog({ onClose, sequelTo }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Left unchosen, a sequel is laid out like the book before it.
  const [templateChoice, setTemplateId] = useState<string | null>(null);
  const [scaffold, setScaffold] = useState(true);
  const [begin, setBegin] = useState<Begin>("write");
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
  const previous = stories.find((s) => s.id === sequelOf) ?? null;
  const candidates = carry && carry.of === sequelOf ? carry.list : null;
  const seriesOf = seriesOfBook && seriesOfBook.of === sequelOf ? seriesOfBook.name : null;
  const templateId = templateChoice ?? previous?.structure_template_id ?? "freeform";

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
          })
        : await api.createStory({
            title: title.trim(),
            description,
            structure_template_id: templateId,
            scaffold,
          });
      upsertStory(story);
      if (begin === "first") navigate(`/stories/${story.id}/first-story`);
      else if (begin === "idea") navigate(`/stories/${story.id}/freewrite`);
      else if (begin === "plan") navigate(`/stories/${story.id}/plan`);
      // Straight into the first scene of the new outline, ready to type.
      else
        navigate(
          story.start_node_id
            ? `/stories/${story.id}/write?node=${story.start_node_id}`
            : `/stories/${story.id}`,
        );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The story could not be made.");
    } finally {
      setLoading(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

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
            : "Create story"}
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
        title={previous ? `The book after “${previous.title}”` : "New story"}
        icon={<BookOpen size={15} />}
        size="sm"
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
                <label className={styles.label}>Title</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={styles.textarea}
                />
              </div>

              {stories.length > 0 && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="sequel-of">
                    A sequel to (optional)
                  </label>
                  <select
                    id="sequel-of"
                    value={sequelOf}
                    onChange={(e) => setSequelOf(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">Nothing: a book of its own</option>
                    {stories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  {previous && (
                    <p className={styles.templateHint}>
                      {seriesOf
                        ? `The book after “${previous.title}” in ${seriesOf}.`
                        : `“${previous.title}” and this book become a series.`}{" "}
                      Genre, tone, point of view and byline carry over; who carries over comes next.
                    </p>
                  )}
                </div>
              )}
              {previous && !seriesOf && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="series-name">
                    The series is called
                  </label>
                  <input
                    id="series-name"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    placeholder={previous.title}
                    className={styles.input}
                  />
                </div>
              )}

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>Story structure</label>
                  <button
                    type="button"
                    onClick={() => setShowTemplateManager(true)}
                    className={styles.manageTemplatesBtn}
                    title="Manage custom templates"
                  >
                    <Settings2 size={12} />
                    Manage
                  </button>
                </div>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className={styles.select}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {!t.is_system ? " (custom)" : ""}
                    </option>
                  ))}
                </select>
                {selectedTemplate?.description && (
                  <p className={styles.templateHint}>{selectedTemplate.description}</p>
                )}
              </div>

              {!!selectedTemplate?.starter_outline?.length && (
                <label className={styles.scaffold}>
                  <input type="checkbox" checked={scaffold} onChange={(e) => setScaffold(e.target.checked)} />
                  <span>
                    Start with an outline
                    <span className={styles.scaffoldHint}>
                      {selectedTemplate.starter_outline.join(" · ")}, with a first{" "}
                      {selectedTemplate.levels[selectedTemplate.levels.length - 1].name.toLowerCase()} ready
                      to write in. Rename, move or delete any of it.
                    </span>
                  </span>
                </label>
              )}
              <fieldset className={styles.begin}>
                <legend className={styles.label}>How do you want to begin?</legend>
                {BEGINNINGS.filter((b) => !(previous && b.id === "first")).map((b) => (
                  <label
                    key={b.id}
                    className={`${styles.beginOption} ${begin === b.id ? styles.beginChosen : ""}`}
                  >
                    <input
                      type="radio"
                      name="begin"
                      value={b.id}
                      checked={begin === b.id}
                      onChange={() => setBegin(b.id)}
                    />
                    <span>
                      <span className={styles.beginName}>{b.label}</span>
                      <span className={styles.beginHint}>{b.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
