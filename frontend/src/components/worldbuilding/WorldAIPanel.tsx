/**
 * WorldAIPanel — reusable inline AI assistance panel for world building.
 *
 * Used in LocationManager, CultureManager, and HistoryTab.
 * Follows EconomyAnalysisPanel pattern: button triggers analysis, results stream inline.
 *
 * This is a guide, not a co-author. Responses surface questions and considerations,
 * never prose or paste-ready content.
 */
import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useLLMStream } from "../../hooks/useLLMStream";
import styles from "./WorldAIPanel.module.css";

interface Props {
  title: string;
  description: string;
  buttonLabel: string;
  onAnalyze: (signal: AbortSignal) => Promise<Response>;
  requestId: string;
}

export default function WorldAIPanel({ title, description, buttonLabel, onAnalyze, requestId }: Props) {
  const [result, setResult] = useState("");
  const [expanded, setExpanded] = useState(true);

  const { stream, text: streamingText, isStreaming: generating } = useLLMStream({
    requestId,
    label: title,
    tabId: "worldbuilding",
    onComplete: (full) => setResult(full),
    onError: () => setResult("⚠ Error running analysis."),
  });

  const displayText = generating ? streamingText : result;

  function analyze() {
    setResult("");
    setExpanded(true);
    stream((signal) => onAnalyze(signal));
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
        <>
          {displayText ? (
            <div className={styles.result}>
              {displayText.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <h4 key={i} className={styles.section}>{line.replace(/\*\*/g, "")}</h4>;
                }
                if (line.trim() === "") return <div key={i} className={styles.spacer} />;
                return <p key={i} className={styles.line}>{line}</p>;
              })}
            </div>
          ) : !generating ? (
            <p className={styles.hint}>{description}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
