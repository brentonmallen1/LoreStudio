import { useState } from "react";
import { CheckCircle, ArrowLeft, User, MapPin, Link2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { ExtractionCandidate, ImportPreviewTree, ImportUploadResponse } from "../../types";
import styles from "./ConfirmStep.module.css";

interface Props {
  uploadResponse: ImportUploadResponse;
  preview: ImportPreviewTree;
  extractionCandidates: ExtractionCandidate[];
  extractionSelected: Set<string>;
  onBack: () => void;
  onFinalized: (storyId: string) => void;
}

export default function ConfirmStep({
  uploadResponse,
  preview,
  extractionCandidates,
  extractionSelected,
  onBack,
  onFinalized,
}: Props) {
  const [title, setTitle] = useState(
    preview.detected_title || uploadResponse.source_format.toUpperCase() + " Import"
  );
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upsertStory } = useStoryStore();

  const topLevelCount = preview.nodes.filter((n) => n.parent_id === null).length;
  const leafCount = preview.nodes.filter(
    (n) => !preview.nodes.some((other) => other.parent_id === n.id)
  ).length;

  const selectedCandidates = extractionCandidates.filter((c) => extractionSelected.has(c.id));
  const selectedChars = selectedCandidates.filter((c) => c.entity_type === "character").length;
  const selectedLocs = selectedCandidates.filter((c) => c.entity_type === "location").length;
  const selectedRels = selectedCandidates.filter((c) => c.entity_type === "relationship").length;
  const hasExtraction = selectedCandidates.length > 0;

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.importFinalize(preview.session_id, {
        title: title.trim(),
        description,
        template_id: preview.template_id,
        genre: "",
        extraction_candidate_ids: Array.from(extractionSelected),
        extraction_candidates: extractionCandidates,
      });
      const stories = await api.listStories();
      stories.forEach(upsertStory);
      onFinalized(result.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <CheckCircle size={20} className={styles.checkIcon} />
        <div>
          <p className={styles.summaryTitle}>Ready to import</p>
          <p className={styles.summaryDetail}>
            {preview.nodes.length} sections · {leafCount} leaf sections · {preview.total_word_count.toLocaleString()} words
            {topLevelCount > 0 && ` · ${topLevelCount} top-level groups`}
          </p>
        </div>
      </div>

      {hasExtraction && (
        <div className={styles.extractionSummary}>
          <span className={styles.extractionLabel}>Lorebook entries to create:</span>
          <div className={styles.extractionCounts}>
            {selectedChars > 0 && (
              <span className={styles.extractionCount}>
                <User size={11} />
                {selectedChars} character{selectedChars !== 1 ? "s" : ""}
              </span>
            )}
            {selectedLocs > 0 && (
              <span className={styles.extractionCount}>
                <MapPin size={11} />
                {selectedLocs} location{selectedLocs !== 1 ? "s" : ""}
              </span>
            )}
            {selectedRels > 0 && (
              <span className={styles.extractionCount}>
                <Link2 size={11} />
                {selectedRels} relationship{selectedRels !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label}>Story title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.input}
            placeholder="Story title"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={styles.textarea}
            placeholder="What is this story about?"
          />
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Structure template</span>
          <span className={styles.infoValue}>
            {preview.template_levels.map((l) => l.name).join(" → ")}
          </span>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.footer}>
        <button onClick={onBack} className={styles.backBtn}>
          <ArrowLeft size={13} />
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || loading}
          className={styles.createBtn}
        >
          {loading ? "Creating story…" : "Create story"}
        </button>
      </div>
    </div>
  );
}
