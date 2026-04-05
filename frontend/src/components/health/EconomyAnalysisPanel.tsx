import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../../api/client";
import { useLLMStream } from "../../hooks/useLLMStream";
import styles from "./EconomyAnalysisPanel.module.css";

interface Props {
  storyId: string;
}

export default function EconomyAnalysisPanel({ storyId }: Props) {
  const [result, setResult] = useState("");

  const { stream, text: streamingText, isStreaming: generating } = useLLMStream({
    requestId: `economy:${storyId}`,
    label: "Analyzing story economy",
    tabId: "health",
    onComplete: (full) => setResult(full),
    onError: () => setResult("⚠ Error running economy analysis."),
  });

  const displayText = generating ? streamingText : result;

  function analyze() {
    setResult("");
    stream((signal) => api.analyzeEconomy(storyId, signal));
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Sparkles size={13} className={styles.icon} />
          <div>
            <h3 className={styles.title}>Economy Analysis</h3>
            <p className={styles.subtitle}>
              AI analysis of thread balance, scene economy, and short fiction tightness
            </p>
          </div>
        </div>
        <button
          onClick={analyze}
          disabled={generating}
          className={styles.analyzeBtn}
        >
          <Sparkles size={12} />
          {generating ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {displayText && (
        <div className={styles.result}>
          {displayText.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return <h4 key={i} className={styles.section}>{line.replace(/\*\*/g, "")}</h4>;
            }
            if (line.trim() === "") return <div key={i} className={styles.spacer} />;
            return <p key={i} className={styles.line}>{line}</p>;
          })}
        </div>
      )}

      {!displayText && !generating && (
        <p className={styles.hint}>
          Run analysis to identify orphaned scenes, thread imbalance, and pacing issues relative
          to your intended story length.
        </p>
      )}
    </div>
  );
}
