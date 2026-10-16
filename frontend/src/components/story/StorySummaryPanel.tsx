import { useState } from "react";
import { BookOpen, Copy, Check, Orbit, Square } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMContextSources } from "../llm";
import KeptAnswerBar from "../ai/kept/KeptAnswerBar";
import { useKeptAnswer } from "../ai/kept/useKeptAnswer";
import styles from "./StorySummaryPanel.module.css";
import { useAIAvailable } from "../../lib/mode";

/**
 * "The story so far" on Story identity. The summary is kept on the story (A7): it is there
 * when the page opens again, through a restart, until it is cleared or asked again.
 */
export default function StorySummaryPanel({ storyId }: { storyId: string }) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const { activeNode } = useStoryStore();
  const [style, setStyle] = useState<"brief" | "detailed">("brief");
  const [upToCurrentScene, setUpToCurrentScene] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const kept = useKeptAnswer({ storyId, type: "story", id: storyId }, "story-summary");
  const summary = typeof kept.answer?.data.text === "string" ? kept.answer.data.text : "";
  const keptUpTo = typeof kept.answer?.data.up_to === "string" ? kept.answer.data.up_to : "";

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
    onComplete: () => void kept.reload(),
    onError: () => setFailed(true),
  });

  const displayText = generating ? streamingText : summary;

  function generate() {
    setFailed(false);
    const upTo = upToCurrentScene && activeNode ? activeNode.id : undefined;
    void stream((signal) => api.summarizeStory(storyId, upTo, style, signal));
  }

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!aiAvailable) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <BookOpen size={14} className={styles.icon} />
        <h3 className={styles.title}>The story so far</h3>
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
          !kept.answer && (
            <button
              onClick={generate}
              className={styles.generateBtn}
              title="Use AI to generate a narrative summary of your story's content to date"
            >
              <Orbit size={12} />
              Generate
            </button>
          )
        )}
      </div>

      <LLMContextSources sources={contextSources} />

      {kept.answer && (
        <KeptAnswerBar
          answer={kept.answer}
          heading="The story so far"
          context={{ storyId }}
          onAskAgain={generate}
          asking={generating}
          onClear={() => void kept.clear()}
        />
      )}

      {displayText && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>
              {!generating && keptUpTo ? `Summary up to ${keptUpTo}` : "Summary"}
            </span>
            <button onClick={() => void copy()} className={styles.copyBtn} title="Copy to clipboard">
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className={styles.resultText}>{displayText}</div>
        </div>
      )}

      {failed && !generating && <p className={styles.hint}>The Assistant could not answer just now.</p>}

      {!displayText && !generating && !failed && (
        <p className={styles.hint}>Generate a summary of your story's content to date.</p>
      )}
    </div>
  );
}
