import { useState, useRef } from "react";
import { BookOpen, Copy, Check, Compass, Square } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources } from "../llm";
import styles from "./StorySummaryPanel.module.css";
import { useAIAvailable } from "../../lib/mode";

export default function StorySummaryPanel({ storyId }: { storyId: string }) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const { activeNode } = useStoryStore();
  const [style, setStyle] = useState<"brief" | "detailed">("brief");
  const [upToCurrentScene, setUpToCurrentScene] = useState(false);
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);
  const lastSummary = useRef("");
  const transparency = useLLMTransparency();

  const previewRequest = {
    context_type: "story-summary",
    story_id: storyId,
    node_id: upToCurrentScene && activeNode ? activeNode.id : undefined,
    style,
  };
  const { sources: contextSources } = useLLMContextSources(storyId ? previewRequest : null);

  const {
    stream,
    cancel,
    text: streamingText,
    isStreaming: generating,
  } = useLLMStream({
    requestId: `story-summary:${storyId}`,
    label: "Generating story summary",
    tabId: "overview",
    onComplete: (full) => {
      setSummary(full);
      lastSummary.current = full;
      transparency.recordInteraction();
    },
    onError: () => setSummary("⚠ Error generating summary."),
  });

  const displayText = generating ? streamingText : summary;

  function generate() {
    setSummary("");
    const upTo = upToCurrentScene && activeNode ? activeNode.id : undefined;
    stream((signal) => api.summarizeStory(storyId, upTo, style, signal));
  }

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!aiAvailable) return null;

  return (
    <>
      <LLMTransparencyModal
        isOpen={transparency.isOpen}
        onClose={transparency.close}
        data={transparency.data}
      />
      <div className={styles.panel}>
        <div className={styles.header}>
          <BookOpen size={14} className={styles.icon} />
          <h3 className={styles.title}>The story so far</h3>
          <LLMTransparencyTrigger
            disabled={!transparency.hasData}
            onClick={() =>
              transparency.open(previewRequest, lastSummary.current, {
                feature: "story-summary",
                story_id: storyId,
              })
            }
          />
        </div>

        <div className={styles.controls}>
          <div className={styles.styleToggle}>
            {(["brief", "detailed"] as const).map((s) => (
              <button
                key={s}
                className={`${styles.styleBtn} ${style === s ? styles.styleActive : ""}`}
                onClick={() => setStyle(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {activeNode && (
            <label className={styles.scopeLabel}>
              <input
                type="checkbox"
                checked={upToCurrentScene}
                onChange={(e) => setUpToCurrentScene(e.target.checked)}
                className={styles.checkbox}
              />
              Up to current scene
            </label>
          )}

          {generating ? (
            <button onClick={cancel} className={styles.generateBtn} style={{ color: "var(--color-danger)" }}>
              <Square size={12} />
              Cancel
            </button>
          ) : (
            <button
              onClick={generate}
              className={styles.generateBtn}
              title="Use AI to generate a narrative summary of your story's content to date"
            >
              <Compass size={12} />
              Generate
            </button>
          )}
        </div>

        <LLMContextSources sources={contextSources} />

        {displayText && (
          <div className={styles.result}>
            <div className={styles.resultHeader}>
              <span className={styles.resultLabel}>Summary</span>
              <button onClick={copy} className={styles.copyBtn} title="Copy to clipboard">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <div className={styles.resultText}>{displayText}</div>
          </div>
        )}

        {!displayText && !generating && (
          <p className={styles.hint}>Generate a summary of your story's content to date.</p>
        )}
      </div>
    </>
  );
}
