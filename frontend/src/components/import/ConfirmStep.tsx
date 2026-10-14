import { useState } from "react";
import { CheckCircle, ArrowLeft, User, MapPin, Link2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { choiceOf, plural, tally } from "../../lib/import/novelcrafter";
import type { ExtractionCandidate, ImportPreviewTree, ImportUploadResponse } from "../../types";
import type { NovelcrafterChoices } from "../../types/novelcrafter";
import styles from "./ConfirmStep.module.css";

interface Props {
  uploadResponse: ImportUploadResponse;
  preview: ImportPreviewTree;
  extractionCandidates: ExtractionCandidate[];
  extractionSelected: Set<string>;
  /** A Novelcrafter export: what the author chose in What comes over (doc 28). */
  novelcrafter?: NovelcrafterChoices;
  onBack: () => void;
  onFinalized: (storyId: string, recordId?: string | null) => void;
}

export default function ConfirmStep({
  uploadResponse,
  preview,
  extractionCandidates,
  extractionSelected,
  novelcrafter,
  onBack,
  onFinalized,
}: Props) {
  const nc = uploadResponse.novelcrafter;
  const ncTally = nc && novelcrafter ? tally(nc, novelcrafter) : null;
  const ncCount = (target: string) =>
    nc && novelcrafter ? nc.entries.filter((e) => choiceOf(e, novelcrafter).target === target).length : 0;
  const [title, setTitle] = useState(
    preview.detected_title || uploadResponse.source_format.toUpperCase() + " Import",
  );
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upsertStory } = useStoryStore();

  const topLevelCount = preview.nodes.filter((n) => n.parent_id === null).length;
  const leafCount = preview.nodes.filter(
    (n) => !preview.nodes.some((other) => other.parent_id === n.id),
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
        ...(novelcrafter ? { novelcrafter } : {}),
      });
      const stories = await api.listStories();
      stories.forEach(upsertStory);
      onFinalized(result.id, result.record_id);
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
            {preview.nodes.length} sections · {leafCount} leaf sections ·{" "}
            {preview.total_word_count.toLocaleString()} words
            {topLevelCount > 0 && ` · ${topLevelCount} top-level groups`}
          </p>
        </div>
      </div>

      {ncTally && (
        <div className={styles.extractionSummary} data-plain>
          <span className={styles.extractionLabel}>From the codex:</span>
          <div className={styles.extractionCounts}>
            {(
              [
                ["character", "character"],
                ["location", "place"],
                ["thread", "thread"],
                ["trope", "trope"],
              ] as const
            ).map(([target, one]) =>
              ncCount(target) ? (
                <span key={target} className={styles.extractionCount}>
                  {plural(ncCount(target), one)}
                </span>
              ) : null,
            )}
            {ncTally.later > 0 && (
              <span className={styles.extractionCount}>{ncTally.later} wait in Proposals</span>
            )}
          </div>
        </div>
      )}

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
          <span className={styles.infoValue}>{preview.template_levels.map((l) => l.name).join(" → ")}</span>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.footer}>
        <button onClick={onBack} className={styles.backBtn}>
          <ArrowLeft size={13} />
          Back
        </button>
        <button onClick={handleCreate} disabled={!title.trim() || loading} className={styles.createBtn}>
          {loading ? "Creating story…" : "Create story"}
        </button>
      </div>
    </div>
  );
}
