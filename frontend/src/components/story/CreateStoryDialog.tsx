import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Settings2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryStructureTemplate } from "../../types";
import TemplateManagerDialog from "../templates/TemplateManagerDialog";
import { Modal } from "../common";
import styles from "./CreateStoryDialog.module.css";

type Begin = "write" | "idea" | "plan";

/** Three ways in (refactor doc 10 P7); none is a gate, and writing stays one click away. */
const BEGINNINGS: { id: Begin; label: string; hint: string }[] = [
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
}

export default function CreateStoryDialog({ onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("freeform");
  const [scaffold, setScaffold] = useState(true);
  const [begin, setBegin] = useState<Begin>("write");
  const [templates, setTemplates] = useState<StoryStructureTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const { upsertStory } = useStoryStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.listStructureTemplates().then(setTemplates).catch(console.error);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const story = await api.createStory({
        title: title.trim(),
        description,
        structure_template_id: templateId,
        scaffold,
      });
      upsertStory(story);
      if (begin === "idea") navigate(`/stories/${story.id}/plan?view=ideas`);
      else if (begin === "plan") navigate(`/stories/${story.id}/plan`);
      // Straight into the first scene of the new outline, ready to type.
      else
        navigate(
          story.start_node_id
            ? `/stories/${story.id}/write?node=${story.start_node_id}`
            : `/stories/${story.id}`,
        );
    } finally {
      setLoading(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const footer = (
    <>
      <button type="button" onClick={onClose} className={styles.cancelBtn}>
        Cancel
      </button>
      <button
        type="submit"
        form="create-story-form"
        disabled={loading || !title.trim()}
        className={styles.submitBtn}
      >
        {loading ? "Creating…" : "Create story"}
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
        title="New story"
        icon={<BookOpen size={15} />}
        size="sm"
        footer={footer}
      >
        <form id="create-story-form" onSubmit={handleSubmit} className={styles.form}>
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
                  {selectedTemplate.levels[selectedTemplate.levels.length - 1].name.toLowerCase()} ready to
                  write in. Rename, move or delete any of it.
                </span>
              </span>
            </label>
          )}
          <fieldset className={styles.begin}>
            <legend className={styles.label}>How do you want to begin?</legend>
            {BEGINNINGS.map((b) => (
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
        </form>
      </Modal>
    </>
  );
}
