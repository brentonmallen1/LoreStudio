import { useState, useCallback, useEffect, useRef } from "react";
import { AlignLeft, Compass, HelpCircle, Search, Play, Loader2, BarChart3, Activity, GitMerge, Palette, Skull, FileCheck, ClipboardCheck, Repeat2, Users, ScrollText, Square } from "lucide-react";
import { api } from "../../api/client";
import type { ActivityLog } from "../../types";
import styles from "./ActionToolbar.module.css";

interface AnalysisDef {
  id: string;
  label: string;
  description: string;
  type: "nlp" | "ai";
  Icon: React.ElementType;
  run: (storyId: string, signal: AbortSignal) => Promise<unknown>;
  summarize: (log: ActivityLog) => string;
}

const ANALYSES: AnalysisDef[] = [
  {
    id: "scene-summary-batch",
    label: "Scene Summaries",
    description: "Generate AI summaries for all scenes · powers context-aware character interviews",
    type: "ai",
    Icon: ScrollText,
    run: (id, signal) => api.summarizeScenesBatch(id, undefined, undefined, signal),
    summarize: (log) => {
      const s = log.metadata_?.summarized_count as number | undefined;
      const k = log.metadata_?.skipped_count as number | undefined;
      if (s == null) return log.description;
      if (s === 0 && k != null && k > 0) return `${k} scene${k !== 1 ? "s" : ""} already fresh`;
      return `${s} scene${s !== 1 ? "s" : ""} summarized`;
    },
  },
  {
    id: "prose-analysis",
    label: "Prose Check",
    description: "Passive voice · adverbs · said-bookisms · repeated words · sentence variety",
    type: "nlp",
    Icon: AlignLeft,
    run: (id, signal) => api.analyzeProseNLP(id, undefined, undefined, signal),
    summarize: (log) => {
      const w = log.metadata_?.warning_count as number | undefined;
      const s = log.metadata_?.scene_count as number | undefined;
      if (w == null || s == null) return log.description;
      return w === 0 ? `${s} scenes — clean` : `${s} scenes · ${w} warning${w !== 1 ? "s" : ""}`;
    },
  },
  {
    id: "entity-suggestions",
    label: "Lorebook Scan",
    description: "Named characters & locations in prose not yet in your Lorebook",
    type: "nlp",
    Icon: Search,
    run: (id, signal) => api.analyzeEntitySuggestions(id, signal),
    summarize: (log) => {
      const c = log.metadata_?.character_count as number | undefined;
      const l = log.metadata_?.location_count as number | undefined;
      if (c == null || l == null) return log.description;
      const total = c + l;
      return total === 0 ? "No new entities" : `${total} potential ${total !== 1 ? "entries" : "entry"}`;
    },
  },
  {
    id: "economy-analysis",
    label: "Story Economy",
    description: "Thread balance · scene economy · MICE tightness · pacing for intended length",
    type: "ai",
    Icon: BarChart3,
    run: (id, signal) => api.analyzeEconomy(id, signal),
    summarize: () => "Analysis run",
  },
  {
    id: "essential-questions",
    label: "Story Compass",
    description: "Are the 6 essential story questions answerable for your protagonist?",
    type: "ai",
    Icon: HelpCircle,
    run: (id, signal) => api.analyzeEssentialQuestions(id, undefined, signal),
    summarize: (log) => {
      const name = log.metadata_?.character_name as string | undefined;
      return name ? `Analyzed for ${name}` : "Analysis run";
    },
  },
  {
    id: "editorial-consistency",
    label: "Editorial Check",
    description: "Tense consistency · POV drift — deterministic, no AI required",
    type: "nlp",
    Icon: FileCheck,
    run: (id, signal) => api.analyzeEditorialConsistency(id, signal),
    summarize: (log) => {
      const t = log.metadata_?.tense_shift_count as number | undefined;
      const p = log.metadata_?.pov_flag_count as number | undefined;
      const s = log.metadata_?.scene_count as number | undefined;
      if (t == null || p == null) return log.description;
      const total = t + p;
      return total === 0 ? `${s} scenes — clean` : `${t} tense shift${t !== 1 ? "s" : ""} · ${p} POV flag${p !== 1 ? "s" : ""}`;
    },
  },
  {
    id: "pacing-analysis",
    label: "Pacing Analysis",
    description: "Act balance · tension curve · slow spots · structural rhythm",
    type: "ai",
    Icon: Activity,
    run: (id, signal) => api.analyzePacing(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.issue_count as number | undefined;
      return n != null ? (n === 0 ? "No pacing concerns" : `${n} slow spot${n !== 1 ? "s" : ""}`) : "Analysis run";
    },
  },
  {
    id: "continuity-check",
    label: "Continuity Check",
    description: "Flag inconsistencies in character knowledge, timeline, and details",
    type: "ai",
    Icon: GitMerge,
    run: (id, signal) => api.analyzeContinuity(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.issue_count as number | undefined;
      return n != null ? (n === 0 ? "No issues found" : `${n} continuity issue${n !== 1 ? "s" : ""}`) : "Analysis run";
    },
  },
  {
    id: "theme-tracker",
    label: "Theme Tracker",
    description: "Identify recurring themes, motifs, and their development",
    type: "ai",
    Icon: Palette,
    run: (id, signal) => api.analyzeThemes(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.theme_count as number | undefined;
      return n != null ? `${n} theme${n !== 1 ? "s" : ""} identified` : "Analysis run";
    },
  },
  {
    id: "plot-holes",
    label: "Plot Holes",
    description: "Detect logical gaps, inconsistencies, and unanswered story questions",
    type: "ai",
    Icon: Skull,
    run: (id, signal) => api.analyzePlotHoles(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.hole_count as number | undefined;
      return n != null ? (n === 0 ? "No holes found" : `${n} plot hole${n !== 1 ? "s" : ""}`) : "Analysis run";
    },
  },
  {
    id: "first-pass",
    label: "First-Pass Editor",
    description: "Compare written prose against stated intent, goals, and character arc milestones",
    type: "ai",
    Icon: ClipboardCheck,
    run: (id, signal) => api.analyzeFirstPass(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.gap_count as number | undefined;
      return n != null ? (n === 0 ? "Intent well realized" : `${n} intent gap${n !== 1 ? "s" : ""}`) : "Analysis run";
    },
  },
  {
    id: "cliche-analysis",
    label: "Cliche Check",
    description: "Overused phrases · character tropes · plot devices · tired descriptions",
    type: "ai",
    Icon: Repeat2,
    run: (id, signal) => api.analyzeCliches(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.cliche_count as number | undefined;
      return n != null ? (n === 0 ? "No clichés found" : `${n} cliché${n !== 1 ? "s" : ""} found`) : "Analysis run";
    },
  },
  {
    id: "character-dimensionality",
    label: "Character Depth",
    description: "Dimensionality · contradictions · relationship complexity · role appropriateness",
    type: "ai",
    Icon: Users,
    run: (id, signal) => api.analyzeCharacterDimensionality(id, signal),
    summarize: (log) => {
      const n = log.metadata_?.character_count as number | undefined;
      return n != null ? `${n} character${n !== 1 ? "s" : ""} assessed` : "Assessment run";
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
  storyId: string;
  onAnalysisComplete: () => void;
  onViewReports: () => void;
}

export default function ActionToolbar({ storyId, onAnalysisComplete, onViewReports }: Props) {
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [latest, setLatest] = useState<Record<string, ActivityLog | null>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLatest = useCallback(() => {
    Promise.all(
      ANALYSES.map((a) => api.getLatestAnalysis(storyId, a.id).catch(() => null))
    ).then((results) => {
      const map: Record<string, ActivityLog | null> = {};
      ANALYSES.forEach((a, i) => { map[a.id] = results[i]; });
      setLatest(map);
    });
  }, [storyId]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  const runAnalysis = useCallback(async (analysis: AnalysisDef, signal: AbortSignal) => {
    setRunning((prev) => new Set(prev).add(analysis.id));
    setErrors((prev) => { const s = new Set(prev); s.delete(analysis.id); return s; });
    try {
      await analysis.run(storyId, signal);
      if (!signal.aborted) {
        onAnalysisComplete();
        fetchLatest();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!signal.aborted) {
        setErrors((prev) => new Set(prev).add(analysis.id));
      }
    } finally {
      setRunning((prev) => { const s = new Set(prev); s.delete(analysis.id); return s; });
    }
  }, [storyId, onAnalysisComplete, fetchLatest]);

  const runSingle = useCallback((analysis: AnalysisDef) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    runAnalysis(analysis, controller.signal);
  }, [runAnalysis]);

  const runAll = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    for (const analysis of ANALYSES) {
      if (controller.signal.aborted) break;
      await runAnalysis(analysis, controller.signal);
    }
  }, [runAnalysis]);

  const stopAll = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setRunning(new Set());
  }, []);

  const anyRunning = running.size > 0;

  return (
    <div className={styles.toolbar}>
      <div className={styles.legend}>
        <span className={styles.legendItem} style={{ "--type-color": "var(--color-nlp)" } as React.CSSProperties}>
          <span className={styles.legendDot} />
          Local NLP — fast, no AI required
        </span>
        <span className={styles.legendSep} />
        <span className={styles.legendItem} style={{ "--type-color": "var(--color-ai)" } as React.CSSProperties}>
          <span className={styles.legendDot} />
          AI — requires Ollama
        </span>
        <button className={styles.reportsLink} onClick={onViewReports}>
          View Reports →
        </button>
      </div>

      <div className={styles.actions}>
        {ANALYSES.map((analysis) => {
          const isRunning = running.has(analysis.id);
          const hasError = errors.has(analysis.id);
          const log = latest[analysis.id];
          const typeColor = analysis.type === "nlp" ? "var(--color-nlp)" : "var(--color-ai)";

          return (
            <button
              key={analysis.id}
              className={`${styles.actionBtn} ${hasError ? styles.actionBtnError : ""}`}
              onClick={() => runSingle(analysis)}
              disabled={isRunning || anyRunning}
              style={{ "--btn-color": typeColor } as React.CSSProperties}
              title={analysis.description}
            >
              <div className={styles.btnMain}>
                <div className={styles.btnIcon}>
                  {isRunning
                    ? <Loader2 size={14} className={styles.spinner} />
                    : <analysis.Icon size={14} />
                  }
                </div>
                <div className={styles.btnBody}>
                  <span className={styles.btnLabel}>
                    {isRunning ? "Running…" : analysis.label}
                  </span>
                  <span className={styles.btnDesc}>{analysis.description}</span>
                  {isRunning ? null : log ? (
                    <span className={styles.btnMeta}>
                      <span className={styles.btnSummary}>{analysis.summarize(log)}</span>
                      <span className={styles.btnAge}>{formatAge(log.created_at)}</span>
                    </span>
                  ) : (
                    <span className={styles.btnNotRun}>Not run yet</span>
                  )}
                </div>
              </div>
              <Compass size={16} className={styles.typeCompass} />
            </button>
          );
        })}

        {anyRunning ? (
          <button
            className={styles.stopBtn}
            onClick={stopAll}
            title="Stop running analyses"
          >
            <Square size={13} />
            Stop
          </button>
        ) : (
          <button
            className={styles.runAllBtn}
            onClick={runAll}
            title="Run all analyses sequentially"
          >
            <Play size={13} />
            Run All
          </button>
        )}
      </div>
    </div>
  );
}
