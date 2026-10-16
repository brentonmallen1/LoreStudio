import { useState, useCallback } from "react";
import { Orbit, Loader2, ChevronDown, ChevronRight, Waves, AlignLeft } from "lucide-react";
import { api } from "../../api/client";
import type { VoiceDistinctnessResult, CharacterDialogueProseResult } from "../../types";
import styles from "./CharacterDialogueActionToolbar.module.css";

interface AnalysisDef {
  id: "voice-distinctness" | "dialogue-prose";
  label: string;
  description: string;
  Icon: React.ElementType;
  run: (characterId: string) => Promise<unknown>;
}

/**
 * The Dialogue view's own readings, made on this machine (so in both modes). Voice Fidelity,
 * the Assistant's reading, moved to the sheet's Assistant menu (A7), where its answer is kept.
 */
const ANALYSES: AnalysisDef[] = [
  {
    id: "voice-distinctness",
    label: "Voice distinctness",
    description: "Vocabulary richness · signature words · how distinct this voice is vs other characters",
    Icon: Waves,
    run: (id) => api.analyzeCharacterVoice(id),
  },
  {
    id: "dialogue-prose",
    label: "Prose quality",
    description: "Adverbs · said-bookisms · sentence variety in this character's dialogue",
    Icon: AlignLeft,
    run: (id) => api.analyzeCharacterDialogueProse(id),
  },
];

interface Props {
  characterId: string;
  hasDialogue: boolean;
  onVoiceResult: (result: VoiceDistinctnessResult) => void;
  onProseResult: (result: CharacterDialogueProseResult) => void;
  onError: (analysisId: string, message: string) => void;
}

export default function CharacterDialogueActionToolbar({
  characterId,
  hasDialogue,
  onVoiceResult,
  onProseResult,
  onError,
}: Props) {
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Set<string>>(new Set());

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

  async function runAnalysis(analysis: AnalysisDef) {
    setRunning((prev) => new Set(prev).add(analysis.id));
    setErrors((prev) => {
      const s = new Set(prev);
      s.delete(analysis.id);
      return s;
    });
    try {
      const result = await analysis.run(characterId);
      if (analysis.id === "voice-distinctness") onVoiceResult(result as VoiceDistinctnessResult);
      else onProseResult(result as CharacterDialogueProseResult);
    } catch {
      setErrors((prev) => new Set(prev).add(analysis.id));
      onError(analysis.id, "Analysis failed. Ensure the character has attributed dialogue.");
    } finally {
      setRunning((prev) => {
        const s = new Set(prev);
        s.delete(analysis.id);
        return s;
      });
    }
  }

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
        <span className={styles.toolbarTitle}>Dialogue analysis</span>
        <div className={styles.toolbarLegend}>
          <span
            className={styles.legendItem}
            style={{ "--type-color": "var(--color-nlp)" } as React.CSSProperties}
          >
            <span className={styles.legendDot} />
            On this machine
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.toolbarBody}>
          <div className={styles.actions}>
            {ANALYSES.map((analysis) => {
              const isRunning = running.has(analysis.id);
              const hasError = errors.has(analysis.id);
              return (
                <button
                  key={analysis.id}
                  className={`${styles.actionBtn} ${hasError ? styles.actionBtnError : ""}`}
                  onClick={() => void runAnalysis(analysis)}
                  disabled={isRunning || !hasDialogue}
                  style={{ "--btn-color": "var(--color-nlp)" } as React.CSSProperties}
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
                    </div>
                  </div>
                  <Orbit size={14} className={styles.typeIndicator} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
