import { useState } from "react";
import { Compass, BarChart3, Activity, RefreshCw, Lightbulb } from "lucide-react";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import styles from "./EconomyAnalysisPanel.module.css";

const ECONOMY_SCHEMA: SectionConfig[] = [
  { key: "thread_balance", label: "Thread Balance", icon: BarChart3, color: "var(--color-accent)", type: "text" },
  { key: "scene_economy", label: "Scene Economy", icon: Activity, color: "var(--color-warning)", type: "text" },
  { key: "try_fail_cycles", label: "Try/Fail Cycles", icon: RefreshCw, color: "var(--segment-part)", type: "text" },
  { key: "recommendations", label: "Recommendations", icon: Lightbulb, color: "var(--segment-beat)", type: "list" },
];

interface Props {
  storyId: string;
}

export default function EconomyAnalysisPanel({ storyId }: Props) {
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);

  async function analyze() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.analyzeEconomy(storyId);
      setResult(r);
    } catch {
      setResult({ success: false, raw_text: "⚠ Error running economy analysis." });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={13} className={styles.icon} />
          <div>
            <h3 className={styles.title}>Economy Analysis</h3>
            <p className={styles.subtitle}>
              AI analysis of thread balance, scene economy, and short fiction tightness
            </p>
          </div>
        </div>
        <button onClick={analyze} disabled={generating} className={styles.analyzeBtn}>
          <Compass size={12} />
          {generating ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {generating && (
        <p className={styles.hint}>Analyzing…</p>
      )}

      {!generating && result && (
        <div className={styles.result}>
          <StructuredResponseRenderer result={result} schema={ECONOMY_SCHEMA} />
        </div>
      )}

      {!generating && !result && (
        <p className={styles.hint}>
          Run analysis to identify orphaned scenes, thread imbalance, and pacing issues relative
          to your intended story length.
        </p>
      )}
    </div>
  );
}
