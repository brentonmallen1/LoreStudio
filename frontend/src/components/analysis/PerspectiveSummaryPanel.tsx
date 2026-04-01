import { useState } from "react";
import { Layers, Copy, Check } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./PerspectiveSummaryPanel.module.css";

type PerspectiveMode = "structure" | "character";

export default function PerspectiveSummaryPanel({ storyId }: { storyId: string }) {
  const { structure, characters, activeNode } = useStoryStore();
  const [mode, setMode] = useState<PerspectiveMode>("structure");
  const [selectedId, setSelectedId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  // Flatten structure for selection
  function flattenNodes(nodes: import("../../types").StructureNode[]): import("../../types").StructureNode[] {
    return nodes.flatMap((n) => [n, ...flattenNodes(n.children)]);
  }
  const flatNodes = flattenNodes(structure);

  async function generate() {
    if (!selectedId) return;
    setGenerating(true);
    setResult("");
    try {
      let res: Response;
      if (mode === "structure") {
        res = await api.summarizeStructureSection(storyId, selectedId);
      } else {
        res = await api.summarizeCharacterArc(storyId, selectedId);
      }
      if (!res.ok || !res.body) throw new Error("Failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setResult(full);
      }
    } catch {
      setResult("⚠ Error generating summary.");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // When mode changes, reset selection
  function changeMode(m: PerspectiveMode) {
    setMode(m);
    setSelectedId("");
    setResult("");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Layers size={14} className={styles.icon} />
        <h3 className={styles.title}>Perspective Summary</h3>
      </div>

      <div className={styles.controls}>
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === "structure" ? styles.modeActive : ""}`}
            onClick={() => changeMode("structure")}
          >
            Section
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "character" ? styles.modeActive : ""}`}
            onClick={() => changeMode("character")}
          >
            Character
          </button>
        </div>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={styles.select}
        >
          <option value="">
            {mode === "structure" ? "Select section…" : "Select character…"}
          </option>
          {mode === "structure"
            ? flatNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {"  ".repeat(n.level)}{n.title}
                </option>
              ))
            : characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
        </select>

        <button
          onClick={generate}
          disabled={generating || !selectedId}
          className={styles.generateBtn}
        >
          {generating ? "Generating…" : "Summarize"}
        </button>
      </div>

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>
              {mode === "structure" ? "Section Summary" : "Character Arc Status"}
            </span>
            <button onClick={copy} className={styles.copyBtn}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className={styles.resultText}>{result}</div>
        </div>
      )}

      {!result && !generating && (
        <p className={styles.hint}>
          {mode === "structure"
            ? "Select a section to get a summary of its content."
            : "Select a character to see where they are in their arc."}
        </p>
      )}
    </div>
  );
}
