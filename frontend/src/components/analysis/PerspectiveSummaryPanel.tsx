import { useState } from "react";
import { Layers, Copy, Check, Orbit, Square } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { announceKept } from "../../lib/ai/keptEvents";
import { LLMContextSources } from "../llm";
import KeptAnswerBar from "../ai/kept/KeptAnswerBar";
import { useKeptAnswer } from "../ai/kept/useKeptAnswer";
import styles from "./PerspectiveSummaryPanel.module.css";
import { useAIAvailable } from "../../lib/mode";
import type { StructureNode } from "../../types";

type PerspectiveMode = "structure" | "character";

function flattenNodes(nodes: StructureNode[]): StructureNode[] {
  return nodes.flatMap((n) => [n, ...flattenNodes(n.children)]);
}

/**
 * A section's summary, or where a character is in their arc, from Story identity. The answer
 * is kept on the section or the character (A7): choosing it again shows what was said, until
 * it is cleared or asked again, through a restart.
 */
export default function PerspectiveSummaryPanel({ storyId }: { storyId: string }) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const { structure, characters } = useStoryStore();
  const [mode, setMode] = useState<PerspectiveMode>("structure");
  const [selectedId, setSelectedId] = useState("");
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const flatNodes = flattenNodes(structure);
  const subject = selectedId
    ? { storyId, type: mode === "structure" ? ("node" as const) : ("character" as const), id: selectedId }
    : null;
  const kept = useKeptAnswer(subject, mode === "structure" ? "structure-summary" : "character-arc");
  const keptText = typeof kept.answer?.data.text === "string" ? kept.answer.data.text : "";
  const subjectName =
    mode === "structure"
      ? flatNodes.find((n) => n.id === selectedId)?.title
      : characters.find((c) => c.id === selectedId)?.name;

  const { sources: contextSources } = useLLMContextSources(
    selectedId
      ? mode === "structure"
        ? { context_type: "structure-summary", story_id: storyId, node_id: selectedId }
        : { context_type: "character-arc", story_id: storyId, character_id: selectedId }
      : null,
  );

  const {
    stream,
    cancel,
    text: streamingText,
    isStreaming: generating,
  } = useLLMStream({
    requestId:
      mode === "structure" ? `perspective:structure:${selectedId}` : `perspective:character:${selectedId}`,
    label: mode === "structure" ? "Summarizing section" : "Summarizing character arc",
    tabId: "story-identity",
    onComplete: () => {
      void kept.reload();
      if (subject) announceKept(subject);
    },
    onError: () => setFailed(true),
  });

  const displayText = generating ? streamingText : keptText;

  function generate() {
    if (!selectedId) return;
    setFailed(false);
    if (mode === "structure") {
      void stream((signal) => api.summarizeStructureSection(storyId, selectedId, signal));
    } else {
      void stream((signal) => api.summarizeCharacterArc(storyId, selectedId, signal));
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(keptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function changeMode(m: PerspectiveMode) {
    setMode(m);
    setSelectedId("");
    setFailed(false);
  }

  if (!aiAvailable) return null;

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
          onChange={(e) => {
            setSelectedId(e.target.value);
            setFailed(false);
          }}
          className={styles.select}
          aria-label={mode === "structure" ? "Section" : "Character"}
        >
          <option value="">{mode === "structure" ? "Select section…" : "Select character…"}</option>
          {mode === "structure"
            ? flatNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {"  ".repeat(n.level)}
                  {n.title}
                </option>
              ))
            : characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
        </select>

        {generating ? (
          <button onClick={cancel} className={styles.generateBtn} style={{ color: "var(--color-danger)" }}>
            <Square size={12} />
            Cancel
          </button>
        ) : (
          !kept.answer && (
            <button
              onClick={generate}
              disabled={!selectedId}
              className={styles.generateBtn}
              title="Summarize a section, or say where a character is in their arc"
            >
              <Orbit size={12} />
              Summarize
            </button>
          )
        )}
      </div>

      <LLMContextSources sources={contextSources} />

      {kept.answer && subject && (
        <KeptAnswerBar
          answer={kept.answer}
          heading={`${mode === "structure" ? "Section summary" : "Arc so far"}: ${subjectName ?? ""}`}
          context={{ storyId, characterId: mode === "character" ? selectedId : undefined }}
          onAskAgain={generate}
          asking={generating}
          onClear={() => void kept.clear()}
        />
      )}

      {displayText && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>
              {mode === "structure" ? "Section summary" : "Where they are in their arc"}
            </span>
            {!generating && (
              <button onClick={() => void copy()} className={styles.copyBtn} aria-label="Copy to clipboard">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
          <div className={styles.resultText}>{displayText}</div>
        </div>
      )}

      {failed && !generating && <p className={styles.hint}>The Assistant could not answer just now.</p>}

      {!displayText && !generating && !failed && (
        <p className={styles.hint}>
          {mode === "structure"
            ? "Select a section to get a summary of its content."
            : "Select a character to see where they are in their arc."}
        </p>
      )}
    </div>
  );
}
