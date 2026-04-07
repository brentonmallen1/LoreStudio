/**
 * WorldAIStructuredPanel — reusable inline AI assistance panel for world building.
 *
 * Uses structured JSON output (via generate_structured) and renders results
 * as styled section cards using StructuredResponseRenderer.
 *
 * Replaces WorldAIPanel (streaming markdown) for all world building features.
 */
import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import styles from "./WorldAIPanel.module.css";

interface Props {
  title: string;
  description: string;
  buttonLabel: string;
  schema: SectionConfig[];
  onAnalyze: () => Promise<StructuredResult>;
  onApply?: (key: string, value: unknown) => void;
  requestId: string;
}

export default function WorldAIStructuredPanel({
  title,
  description,
  buttonLabel,
  schema,
  onAnalyze,
  onApply,
}: Props) {
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setResult(null);
    setError(null);
    setExpanded(true);
    setGenerating(true);
    try {
      const r = await onAnalyze();
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error running analysis.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button
          className={styles.titleRow}
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          <Sparkles size={13} className={styles.icon} />
          <span className={styles.title}>{title}</span>
          {expanded ? <ChevronUp size={12} className={styles.chevron} /> : <ChevronDown size={12} className={styles.chevron} />}
        </button>
        <button
          onClick={analyze}
          disabled={generating}
          className={styles.analyzeBtn}
          type="button"
        >
          <Sparkles size={11} />
          {generating ? "Thinking…" : result ? "Re-run" : buttonLabel}
        </button>
      </div>

      {expanded && (
        <div className={styles.result}>
          {generating && <p className={styles.hint}>Analyzing…</p>}
          {error && <p className={styles.hint} style={{ color: "var(--color-danger)" }}>⚠ {error}</p>}
          {!generating && result && (
            <StructuredResponseRenderer result={result} schema={schema} onApply={onApply} />
          )}
          {!generating && !result && !error && (
            <p className={styles.hint}>{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
