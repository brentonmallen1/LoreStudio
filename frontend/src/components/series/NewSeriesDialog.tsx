import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookCopy } from "lucide-react";
import { seriesApi } from "../../api/series";
import { seriesPath } from "../../lib/series/sections";
import { toast } from "../../stores/toastStore";
import { Modal } from "../common";
import ShapePicker from "./plan/ShapePicker";
import styles from "../story/CreateStoryDialog.module.css";

/**
 * A series before any book of it (series v2): a name and, if it is known yet, what the books
 * are about together. It opens on the series' Plan, where its books, their parts and the arc
 * across them are worked out, as much or as little as the author likes.
 */
export default function NewSeriesDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [premise, setPremise] = useState("");
  const [shape, setShape] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const series = await seriesApi.create({ name: name.trim(), premise: premise.trim(), story_ids: [] });
      if (shape)
        await seriesApi
          .applyShape(series.id, shape)
          .catch(() =>
            toast.error("The series was made, but its shape could not be applied: try it from its Plan."),
          );
      onClose();
      navigate(seriesPath(series.id, "plan"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The series could not be made.");
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New series"
      icon={<BookCopy size={15} />}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
          <button
            type="submit"
            form="new-series-form"
            disabled={busy || !name.trim()}
            className={styles.submitBtn}
          >
            {busy ? "Making it…" : "Plan the series"}
          </button>
        </>
      }
    >
      <form id="new-series-form" onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="series-new-name">
            Name
          </label>
          <input
            id="series-new-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Lighthouse Years"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="series-new-premise">
            What the books are about, together (optional)
          </label>
          <textarea
            id="series-new-premise"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            rows={3}
            placeholder="A lighthouse, and the three generations who keep it…"
            className={styles.textarea}
          />
          <p className={styles.templateHint}>
            Next, its Plan: the books, what each one does, and anything that changes from book to book. Every
            step is optional; start writing whenever you like.
          </p>
        </div>
        <ShapePicker series={{ books: [], axes: [] }} value={shape} onChange={setShape} />
      </form>
    </Modal>
  );
}
