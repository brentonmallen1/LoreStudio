import { useState } from "react";
import { BookOpen, Copy, Check } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./StorySummaryPanel.module.css";

export default function StorySummaryPanel({ storyId }: { storyId: string }) {
  const { activeNode } = useStoryStore();
  const [style, setStyle] = useState<"brief" | "detailed">("brief");
  const [upToCurrentScene, setUpToCurrentScene] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setGenerating(true);
    setSummary("");
    try {
      const upTo = upToCurrentScene && activeNode ? activeNode.id : undefined;
      const res = await api.summarizeStory(storyId, upTo, style);
      if (!res.ok || !res.body) throw new Error("Failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setSummary(full);
      }
    } catch {
      setSummary("⚠ Error generating summary.");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <BookOpen size={14} className={styles.icon} />
        <h3 className={styles.title}>The Story So Far</h3>
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

        <button
          onClick={generate}
          disabled={generating}
          className={styles.generateBtn}
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>

      {summary && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>Summary</span>
            <button onClick={copy} className={styles.copyBtn} title="Copy to clipboard">
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className={styles.resultText}>{summary}</div>
        </div>
      )}

      {!summary && !generating && (
        <p className={styles.hint}>Generate a summary of your story's content to date.</p>
      )}
    </div>
  );
}
