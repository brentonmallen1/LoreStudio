import { useState, useCallback, useEffect, useRef } from "react";
import { Compass, Loader2, ChevronDown, ChevronRight, Waves, AlignLeft, UserCheck } from "lucide-react";
import { api } from "../../api/client";
import type {
  ActivityLog,
  VoiceDistinctnessResult,
  CharacterDialogueProseResult,
  VoiceFidelityResult,
  StructuredResult,
} from "../../types";
import styles from "./CharacterDialogueActionToolbar.module.css";

interface AnalysisDef {
  id: string;
  label: string;
  description: string;
  type: "nlp" | "ai";
  Icon: React.ElementType;
  run: (characterId: string, signal: AbortSignal) => Promise<unknown>;
  summarize: (log: ActivityLog) => string;
}

const ANALYSES: AnalysisDef[] = [
  {
    id: "voice-distinctness",
    label: "Voice Distinctness",
    description: "Vocabulary richness · signature words · how distinct this voice is vs other characters",
    type: "nlp",
    Icon: Waves,
    run: (id) => api.analyzeCharacterVoice(id),
    summarize: (log) => {
      const d = log.metadata_?.distinctness as string | undefined;
      if (!d) return log.description;
      if (d === "distinct") return "Voice is distinct";
      if (d === "some_overlap") return "Some overlap with others";
      return "Voices too similar";
    },
  },
  {
    id: "dialogue-prose",
    label: "Prose Quality",
    description: "Adverbs · said-bookisms · sentence variety in this character's dialogue",
    type: "nlp",
    Icon: AlignLeft,
    run: (id) => api.analyzeCharacterDialogueProse(id),
    summarize: (log) => {
      const w = log.metadata_?.word_count as number | undefined;
      return w != null ? `${w} words analyzed` : log.description;
    },
  },
  {
    id: "voice-fidelity",
    label: "Voice Fidelity",
    description: "Does dialogue match this character's intelligence, education, and social manner?",
    type: "ai",
    Icon: UserCheck,
    run: (id, signal) => api.analyzeCharacterVoiceFidelity(id, signal),
    summarize: (log) => {
      const f = log.metadata_?.result as { data?: { overall_fidelity?: string } } | undefined;
      const fidelity = f?.data?.overall_fidelity;
      if (fidelity === "excellent") return "Excellent fidelity";
      if (fidelity === "good") return "Good fidelity";
      if (fidelity === "fair") return "Fair — some inconsistencies";
      if (fidelity === "needs_work") return "Needs work";
      return log.description;
    },
  },
];

function formatAge(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) {
    const mins = Math.round(diffMs / 60000);
    return mins <= 0 ? "just now" : `${mins}m ago`;
  }
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

interface Props {
  characterId: string;
  storyId: string;
  hasDialogue: boolean;
  onVoiceResult: (result: VoiceDistinctnessResult) => void;
  onProseResult: (result: CharacterDialogueProseResult) => void;
  onFidelityResult: (result: VoiceFidelityResult) => void;
  onError: (analysisId: string, message: string) => void;
}

export default function CharacterDialogueActionToolbar({
  characterId,
  storyId,
  hasDialogue,
  onVoiceResult,
  onProseResult,
  onFidelityResult,
  onError,
}: Props) {
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [latest, setLatest] = useState<Record<string, ActivityLog | null>>({});
  const abortRefs = useRef<Record<string, AbortController>>({});

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ls_dialogue_toolbar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ls_dialogue_toolbar_collapsed", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const fetchLatest = useCallback(() => {
    // voice-distinctness and dialogue-prose are not in HEALTH_FEATURES; only voice-fidelity is
    // For the NLP analyses we just skip the last-run info (no ActivityLog written for them)
    api
      .getLatestAnalysis(storyId, "voice-fidelity")
      .then((log) => setLatest((prev) => ({ ...prev, "voice-fidelity": log })))
      .catch(() => {});
  }, [storyId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const runAnalysis = useCallback(
    async (analysis: AnalysisDef) => {
      const controller = new AbortController();
      abortRefs.current[analysis.id] = controller;

      setRunning((prev) => new Set(prev).add(analysis.id));
      setErrors((prev) => {
        const s = new Set(prev);
        s.delete(analysis.id);
        return s;
      });

      try {
        const result = await analysis.run(characterId, controller.signal);
        if (controller.signal.aborted) return;

        if (analysis.id === "voice-distinctness") {
          onVoiceResult(result as VoiceDistinctnessResult);
        } else if (analysis.id === "dialogue-prose") {
          onProseResult(result as CharacterDialogueProseResult);
        } else if (analysis.id === "voice-fidelity") {
          const sr = result as StructuredResult;
          if (sr.success && sr.data) {
            onFidelityResult(sr.data as unknown as VoiceFidelityResult);
          } else if (sr.raw_text) {
            onError(analysis.id, sr.raw_text || "Analysis returned no data.");
          }
          fetchLatest();
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setErrors((prev) => new Set(prev).add(analysis.id));
          onError(analysis.id, "Analysis failed — ensure the character has attributed dialogue.");
        }
      } finally {
        setRunning((prev) => {
          const s = new Set(prev);
          s.delete(analysis.id);
          return s;
        });
        delete abortRefs.current[analysis.id];
      }
    },
    [characterId, onVoiceResult, onProseResult, onFidelityResult, onError, fetchLatest],
  );

  return (
    <div className={styles.toolbar}>
      {/* Header row — always visible */}
      <div
        className={styles.toolbarHeader}
        onClick={toggleCollapsed}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleCollapsed();
        }}
      >
        <span className={styles.toolbarChevron}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </span>
        <span className={styles.toolbarTitle}>Dialogue Analysis</span>
        <div className={styles.toolbarLegend}>
          <span
            className={styles.legendItem}
            style={{ "--type-color": "var(--color-nlp)" } as React.CSSProperties}
          >
            <span className={styles.legendDot} />
            NLP
          </span>
          <span
            className={styles.legendItem}
            style={{ "--type-color": "var(--color-ai)" } as React.CSSProperties}
          >
            <span className={styles.legendDot} />
            AI
          </span>
        </div>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <div className={styles.toolbarBody}>
          <div className={styles.actions}>
            {ANALYSES.map((analysis) => {
              const isRunning = running.has(analysis.id);
              const hasError = errors.has(analysis.id);
              const log = latest[analysis.id] ?? null;
              const typeColor = analysis.type === "nlp" ? "var(--color-nlp)" : "var(--color-ai)";
              const disabled = isRunning || !hasDialogue;

              return (
                <button
                  key={analysis.id}
                  className={`${styles.actionBtn} ${hasError ? styles.actionBtnError : ""}`}
                  onClick={() => runAnalysis(analysis)}
                  disabled={disabled}
                  style={{ "--btn-color": typeColor } as React.CSSProperties}
                  title={!hasDialogue ? "No attributed dialogue found" : analysis.description}
                >
                  <div className={styles.btnMain}>
                    <div className={styles.btnIcon}>
                      {isRunning ? (
                        <Loader2 size={14} className={styles.spinner} />
                      ) : (
                        <analysis.Icon size={14} />
                      )}
                    </div>
                    <div className={styles.btnBody}>
                      <span className={styles.btnLabel}>{isRunning ? "Running…" : analysis.label}</span>
                      <span className={styles.btnDesc}>{analysis.description}</span>
                      {!isRunning && log ? (
                        <span className={styles.btnMeta}>
                          <span className={styles.btnSummary}>{analysis.summarize(log)}</span>
                          <span className={styles.btnAge}>{formatAge(log.created_at)}</span>
                        </span>
                      ) : (
                        !isRunning && <span className={styles.btnNotRun}>Not run yet</span>
                      )}
                    </div>
                  </div>
                  {/* Top-right: Compass = structured report (NLP or AI), Feather = conversational AI */}
                  <Compass size={14} className={styles.typeIndicator} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
