import { useState, useRef } from "react";
import { Layers, Copy, Check } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources } from "../llm";
import styles from "./PerspectiveSummaryPanel.module.css";

type PerspectiveMode = "structure" | "character";

export default function PerspectiveSummaryPanel({ storyId }: { storyId: string }) {
  const { structure, characters } = useStoryStore();
  const [mode, setMode] = useState<PerspectiveMode>("structure");
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const lastResult = useRef("");
  const lastMode = useRef<PerspectiveMode>("structure");
  const lastSelectedId = useRef("");
  const transparency = useLLMTransparency();

  // Flatten structure for selection
  function flattenNodes(nodes: import("../../types").StructureNode[]): import("../../types").StructureNode[] {
    return nodes.flatMap((n) => [n, ...flattenNodes(n.children)]);
  }
  const flatNodes = flattenNodes(structure);

  const requestId = mode === "structure"
    ? `perspective:structure:${selectedId}`
    : `perspective:character:${selectedId}`;

  const { sources: contextSources } = useLLMContextSources(
    selectedId
      ? mode === "structure"
        ? { context_type: "structure-summary", story_id: storyId, node_id: selectedId }
        : { context_type: "character-arc", story_id: storyId, character_id: selectedId }
      : null
  );

  const { stream, text: streamingText, isStreaming: generating } = useLLMStream({
    requestId,
    label: mode === "structure" ? "Summarizing section" : "Summarizing character arc",
    onComplete: (full) => {
      setResult(full);
      lastResult.current = full;
      transparency.recordInteraction();
    },
    onError: () => setResult("⚠ Error generating summary."),
  });

  const displayText = generating ? streamingText : result;

  function generate() {
    if (!selectedId) return;
    lastMode.current = mode;
    lastSelectedId.current = selectedId;
    setResult("");
    if (mode === "structure") {
      stream((signal) => api.summarizeStructureSection(storyId, selectedId, signal));
    } else {
      stream((signal) => api.summarizeCharacterArc(storyId, selectedId, signal));
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
    <>
    <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
    <div className={styles.panel}>
      <div className={styles.header}>
        <Layers size={14} className={styles.icon} />
        <h3 className={styles.title}>Perspective Summary</h3>
        <LLMTransparencyTrigger
          disabled={!transparency.hasData}
          onClick={() => transparency.open(
            lastMode.current === "structure"
              ? { context_type: "structure-summary", story_id: storyId, node_id: lastSelectedId.current }
              : { context_type: "character-arc", story_id: storyId, character_id: lastSelectedId.current },
            lastResult.current,
          )}
        />
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

      <LLMContextSources sources={contextSources} />

      {displayText && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>
              {mode === "structure" ? "Section Summary" : "Character Arc Status"}
            </span>
            <button onClick={copy} className={styles.copyBtn}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className={styles.resultText}>{displayText}</div>
        </div>
      )}

      {!displayText && !generating && (
        <p className={styles.hint}>
          {mode === "structure"
            ? "Select a section to get a summary of its content."
            : "Select a character to see where they are in their arc."}
        </p>
      )}
    </div>
    </>
  );
}
