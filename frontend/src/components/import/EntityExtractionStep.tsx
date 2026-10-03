import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Loader2,
  User,
  MapPin,
  Link2,
  X,
  Cpu,
  Orbit,
} from "lucide-react";
import { api } from "../../api/client";
import type {
  AIEnrichOptions,
  ExtractionCandidate,
  ExtractionOptions,
  ImportPreviewTree,
  ImportUploadResponse,
} from "../../types";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import ExtractionCandidateCard from "./ExtractionCandidateCard";
import styles from "./EntityExtractionStep.module.css";

interface Props {
  uploadResponse: ImportUploadResponse;
  preview: ImportPreviewTree;
  onComplete: (candidates: ExtractionCandidate[], selectedIds: Set<string>) => void;
  onSkip: () => void;
  onBack: () => void;
}

const DEFAULT_NLP_OPTIONS: ExtractionOptions = {
  characters_nlp: true,
  locations_nlp: true,
  characters_ai: false,
  locations_ai: false,
  relationships_ai: false,
};

const DEFAULT_AI_OPTIONS: AIEnrichOptions = {
  characters_ai: true,
  locations_ai: true,
  relationships_ai: false,
};

type Phase = "idle" | "nlp-loading" | "nlp-done" | "ai-loading" | "ai-done";

export default function EntityExtractionStep({ uploadResponse, preview, onComplete, onSkip, onBack }: Props) {
  const [nlpOptions, setNlpOptions] = useState<ExtractionOptions>(DEFAULT_NLP_OPTIONS);
  const [aiOptions, setAiOptions] = useState<AIEnrichOptions>(DEFAULT_AI_OPTIONS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [nlpError, setNlpError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // NLP results: all found, and which are approved (user can remove false positives)
  const [nlpCandidates, setNlpCandidates] = useState<ExtractionCandidate[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Final (possibly AI-enriched) candidates and user selection for Lorebook creation
  const [finalCandidates, setFinalCandidates] = useState<ExtractionCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const aiAvailable = uploadResponse.ai_available;
  const approvedNlpCandidates = nlpCandidates.filter((c) => !removedIds.has(c.id));

  function toggleNlpOption(key: keyof ExtractionOptions) {
    setNlpOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAiOption(key: keyof AIEnrichOptions) {
    setAiOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === "characters_ai" && !prev.characters_ai === false) {
        next.relationships_ai = false;
      }
      return next;
    });
  }

  function removeCandidate(id: string) {
    setRemovedIds((prev) => new Set([...prev, id]));
  }

  function restoreCandidate(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(finalCandidates.map((c) => c.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function handleNlpScan() {
    setPhase("nlp-loading");
    setNlpError(null);
    setNlpCandidates([]);
    setRemovedIds(new Set());
    setFinalCandidates([]);
    try {
      const result = await api.importExtractPreview(preview.session_id, nlpOptions);
      setNlpCandidates(result.candidates);
      setFinalCandidates(result.candidates);
      setSelectedIds(new Set(result.candidates.map((c) => c.id)));
      setPhase("nlp-done");
    } catch (e: unknown) {
      setNlpError(e instanceof Error ? e.message : "NLP scan failed");
      setPhase("idle");
    }
  }

  async function handleAiEnrich() {
    if (approvedNlpCandidates.length === 0) return;
    setPhase("ai-loading");
    setAiError(null);
    try {
      const result = await api.importEnrichCandidates(preview.session_id, approvedNlpCandidates, aiOptions);
      setFinalCandidates(result.candidates);
      setSelectedIds(new Set(result.candidates.map((c) => c.id)));
      setPhase("ai-done");
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "AI enrichment failed");
      setPhase("nlp-done");
    }
  }

  function handleContinue() {
    onComplete(finalCandidates, selectedIds);
  }

  const nlpDone = phase === "nlp-done" || phase === "ai-loading" || phase === "ai-done";
  const aiDone = phase === "ai-done";
  const isLoading = phase === "nlp-loading" || phase === "ai-loading";

  const removedCount = removedIds.size;
  const approvedCount = approvedNlpCandidates.length;

  const chars = finalCandidates.filter((c) => c.entity_type === "character");
  const locs = finalCandidates.filter((c) => c.entity_type === "location");
  const rels = finalCandidates.filter((c) => c.entity_type === "relationship");

  const anyAiOptionEnabled = aiOptions.characters_ai || aiOptions.locations_ai || aiOptions.relationships_ai;

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Extract entities</h3>
          <p className={styles.subtitle}>Populate your Lorebook from the imported manuscript</p>
        </div>
        <AIFeatureInfoTrigger pageId="import" size="md" />
      </div>

      {/* Color legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--color-nlp)" }} />
          Local NLP: fast, no AI required
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--color-ai)" }} />
          AI Analysis: requires Ollama
        </span>
      </div>

      {/* ── Phase 1: NLP Scan ── */}
      <div className={`${styles.phase} ${styles.phaseNlp}`}>
        <div className={styles.phaseHeader}>
          <span className={styles.phaseDot} style={{ background: "var(--color-nlp)" }} />
          <span className={styles.phaseTitle}>Phase 1: Find Names with NLP</span>
          {nlpDone && <span className={styles.phaseDone}>✓ {nlpCandidates.length} found</span>}
        </div>

        {!nlpDone && (
          <div className={styles.phaseOptions}>
            <label className={styles.optionRow}>
              <input
                type="checkbox"
                checked={nlpOptions.characters_nlp}
                onChange={() => toggleNlpOption("characters_nlp")}
                className={styles.checkbox}
              />
              <User size={13} style={{ color: "var(--color-nlp)" }} />
              Characters
            </label>
            <label className={styles.optionRow}>
              <input
                type="checkbox"
                checked={nlpOptions.locations_nlp}
                onChange={() => toggleNlpOption("locations_nlp")}
                className={styles.checkbox}
              />
              <MapPin size={13} style={{ color: "var(--color-nlp)" }} />
              Locations
            </label>
          </div>
        )}

        {!nlpDone && (
          <button
            className={`${styles.phaseBtn} ${styles.nlpBtn}`}
            onClick={handleNlpScan}
            disabled={isLoading || (!nlpOptions.characters_nlp && !nlpOptions.locations_nlp)}
          >
            {phase === "nlp-loading" ? <Loader2 size={13} className={styles.spinner} /> : <Cpu size={13} />}
            {phase === "nlp-loading" ? "Scanning…" : "Scan with NLP"}
          </button>
        )}

        {nlpError && <div className={styles.errorMsg}>{nlpError}</div>}

        {/* NLP candidate review */}
        {nlpDone && nlpCandidates.length === 0 && (
          <p className={styles.emptyState}>
            No entities detected. Try importing a document with character names.
          </p>
        )}

        {nlpDone && nlpCandidates.length > 0 && (
          <div className={styles.nlpReview}>
            <p className={styles.reviewHint}>
              Remove false positives before running AI enrichment.
              {removedCount > 0 && <span className={styles.removedBadge}>{removedCount} removed</span>}
            </p>
            <div className={styles.chipCloud}>
              {nlpCandidates.map((c) => {
                const removed = removedIds.has(c.id);
                const Icon = c.entity_type === "character" ? User : MapPin;
                return (
                  <button
                    key={c.id}
                    className={`${styles.candidateChip} ${removed ? styles.chipRemoved : ""}`}
                    style={{ "--chip-color": "var(--color-nlp)" } as React.CSSProperties}
                    onClick={() => (removed ? restoreCandidate(c.id) : removeCandidate(c.id))}
                    title={removed ? "Click to restore" : "Click to remove"}
                  >
                    <Icon size={11} />
                    {c.name}
                    <span className={styles.chipOccurrences}>{c.occurrences}×</span>
                    <span className={styles.chipRemoveIcon}>{removed ? "↩" : <X size={10} />}</span>
                  </button>
                );
              })}
            </div>
            {approvedCount > 0 && (
              <p className={styles.approvedCount}>
                {approvedCount} candidate{approvedCount !== 1 ? "s" : ""} approved
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Phase 2: AI Enrichment ── */}
      {nlpDone && approvedCount > 0 && (
        <div className={`${styles.phase} ${styles.phaseAi} ${!aiAvailable ? styles.phaseDisabled : ""}`}>
          <div className={styles.phaseHeader}>
            <span className={styles.phaseDot} style={{ background: "var(--color-ai)" }} />
            <span className={styles.phaseTitle}>Phase 2: Extract Details with AI</span>
            {aiDone && <span className={styles.phaseDone}>✓ enriched</span>}
            {!aiAvailable && <span className={styles.unavailableTag}>Ollama unavailable</span>}
          </div>

          {!aiDone && (
            <div className={styles.phaseOptions}>
              <label className={`${styles.optionRow} ${!aiAvailable ? styles.optionRowDisabled : ""}`}>
                <input
                  type="checkbox"
                  checked={aiOptions.characters_ai}
                  disabled={!aiAvailable}
                  onChange={() => toggleAiOption("characters_ai")}
                  className={styles.checkbox}
                />
                <User size={13} style={{ color: "var(--color-ai)" }} />
                Character attributes
              </label>
              <label className={`${styles.optionRow} ${!aiAvailable ? styles.optionRowDisabled : ""}`}>
                <input
                  type="checkbox"
                  checked={aiOptions.locations_ai}
                  disabled={!aiAvailable}
                  onChange={() => toggleAiOption("locations_ai")}
                  className={styles.checkbox}
                />
                <MapPin size={13} style={{ color: "var(--color-ai)" }} />
                Location details
              </label>
              <label
                className={`${styles.optionRow} ${!aiAvailable || !aiOptions.characters_ai ? styles.optionRowDisabled : ""}`}
              >
                <input
                  type="checkbox"
                  checked={aiOptions.relationships_ai}
                  disabled={!aiAvailable || !aiOptions.characters_ai}
                  onChange={() => toggleAiOption("relationships_ai")}
                  className={styles.checkbox}
                />
                <Link2 size={13} style={{ color: "var(--color-ai)" }} />
                Relationships
              </label>
            </div>
          )}

          {!aiDone && aiAvailable && (
            <button
              className={`${styles.phaseBtn} ${styles.aiBtn}`}
              onClick={handleAiEnrich}
              disabled={phase === "ai-loading" || !anyAiOptionEnabled}
            >
              {phase === "ai-loading" ? (
                <Loader2 size={13} className={styles.spinner} />
              ) : (
                <Orbit size={13} />
              )}
              {phase === "ai-loading" ? "Enriching…" : "Enrich with AI"}
            </button>
          )}

          {aiError && <div className={styles.errorMsg}>{aiError}</div>}
        </div>
      )}

      {/* ── Final results: selection for Lorebook creation ── */}
      {(nlpDone || aiDone) && finalCandidates.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle}>
              {aiDone ? "Enriched candidates" : "Candidates"}: select which to add to Lorebook
            </span>
            <div className={styles.selectActions}>
              <button className={styles.selectAllBtn} onClick={selectAll}>
                All
              </button>
              <span className={styles.selectSep}>/</span>
              <button className={styles.selectAllBtn} onClick={selectNone}>
                None
              </button>
              <span className={styles.selectedCount}>{selectedIds.size} selected</span>
            </div>
          </div>

          {chars.length > 0 && (
            <div className={styles.entityGroup}>
              <div className={styles.entityGroupLabel}>
                <User size={13} />
                Characters ({chars.length})
              </div>
              {chars.map((c) => (
                <ExtractionCandidateCard
                  key={c.id}
                  candidate={c}
                  selected={selectedIds.has(c.id)}
                  onToggle={toggleSelected}
                />
              ))}
            </div>
          )}

          {locs.length > 0 && (
            <div className={styles.entityGroup}>
              <div className={styles.entityGroupLabel}>
                <MapPin size={13} />
                Locations ({locs.length})
              </div>
              {locs.map((c) => (
                <ExtractionCandidateCard
                  key={c.id}
                  candidate={c}
                  selected={selectedIds.has(c.id)}
                  onToggle={toggleSelected}
                />
              ))}
            </div>
          )}

          {rels.length > 0 && (
            <div className={styles.entityGroup}>
              <div className={styles.entityGroupLabel}>
                <Link2 size={13} />
                Relationships ({rels.length})
              </div>
              {rels.map((c) => (
                <ExtractionCandidateCard
                  key={c.id}
                  candidate={c}
                  selected={selectedIds.has(c.id)}
                  onToggle={toggleSelected}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={onBack} disabled={isLoading}>
          <ArrowLeft size={14} />
          Back
        </button>
        <button className={styles.skipBtn} onClick={onSkip} disabled={isLoading}>
          <SkipForward size={13} />
          Skip
        </button>
        {nlpDone && (
          <button className={styles.continueBtn} onClick={handleContinue} disabled={isLoading}>
            Continue
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
