import { useState, useCallback, useEffect } from "react";
import { AlignLeft, Compass, HelpCircle, Search, Play, Loader2, BarChart3, ChevronRight } from "lucide-react";
import { api } from "../../api/client";
import type { ActivityLog } from "../../types";
import styles from "./ActionToolbar.module.css";

interface AnalysisDef {
  id: string;
  label: string;
  description: string;
  type: "nlp" | "ai";
  Icon: React.ElementType;
  run: (storyId: string) => Promise<unknown>;
  summarize: (log: ActivityLog) => string;
}

const ANALYSES: AnalysisDef[] = [
  {
    id: "prose-analysis",
    label: "Prose Check",
    description: "Passive voice · adverbs · said-bookisms · repeated words · sentence variety",
    type: "nlp",
    Icon: AlignLeft,
    run: (id) => api.analyzeProseNLP(id),
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
    run: (id) => api.analyzeEntitySuggestions(id),
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
    run: (id) => api.analyzeEconomy(id),
    summarize: () => "Analysis run",
  },
  {
    id: "essential-questions",
    label: "Story Compass",
    description: "Are the 6 essential story questions answerable for your protagonist?",
    type: "ai",
    Icon: HelpCircle,
    run: (id) => api.analyzeEssentialQuestions(id),
    summarize: (log) => {
      const name = log.metadata_?.character_name as string | undefined;
      return name ? `Analyzed for ${name}` : "Analysis run";
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

  const runAnalysis = useCallback(async (analysis: AnalysisDef) => {
    setRunning((prev) => new Set(prev).add(analysis.id));
    setErrors((prev) => { const s = new Set(prev); s.delete(analysis.id); return s; });
    try {
      await analysis.run(storyId);
      onAnalysisComplete();
      fetchLatest();
    } catch {
      setErrors((prev) => new Set(prev).add(analysis.id));
    } finally {
      setRunning((prev) => { const s = new Set(prev); s.delete(analysis.id); return s; });
    }
  }, [storyId, onAnalysisComplete, fetchLatest]);

  const runAll = useCallback(async () => {
    for (const analysis of ANALYSES) {
      if (!running.has(analysis.id)) {
        await runAnalysis(analysis);
      }
    }
  }, [running, runAnalysis]);

  const anyRunning = running.size > 0;
  const hasAny = Object.values(latest).some(Boolean);

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
              onClick={() => runAnalysis(analysis)}
              disabled={isRunning || anyRunning}
              style={{ "--btn-color": typeColor } as React.CSSProperties}
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

        <button
          className={styles.runAllBtn}
          onClick={runAll}
          disabled={anyRunning}
          title="Run all analyses sequentially"
        >
          {anyRunning
            ? <Loader2 size={13} className={styles.spinner} />
            : <Play size={13} />
          }
          {anyRunning ? "Running…" : "Run All"}
        </button>
      </div>
    </div>
  );
}
