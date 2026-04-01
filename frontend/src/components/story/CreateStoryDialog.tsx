import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryStructureTemplate } from "../../types";
import styles from "./CreateStoryDialog.module.css";

interface Props {
  onClose: () => void;
}

export default function CreateStoryDialog({ onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("freeform");
  const [templates, setTemplates] = useState<StoryStructureTemplate[]>([]);
  const [loading, setLoading] = useState(false);
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
      const story = await api.createStory({ title: title.trim(), description, structure_template_id: templateId });
      upsertStory(story);
      navigate(`/stories/${story.id}`);
    } finally {
      setLoading(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHead}>
          <h2 className={styles.dialogTitle}>New Story</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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
            <label className={styles.label}>Story structure</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={styles.select}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTemplate?.description && (
              <p className={styles.templateHint}>{selectedTemplate.description}</p>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className={styles.submitBtn}
            >
              {loading ? "Creating…" : "Create story"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
