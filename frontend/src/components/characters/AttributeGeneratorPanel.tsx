import { useState, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources } from "../llm";
import styles from "./AttributeGeneratorPanel.module.css";

const ATTRIBUTE_TYPES = [
  { value: "traits", label: "Traits" },
  { value: "backstory", label: "Backstory elements" },
  { value: "quirks", label: "Quirks & mannerisms" },
  { value: "appearance", label: "Appearance" },
];

interface Props {
  character: Character;
  onClose: () => void;
}

export default function AttributeGeneratorPanel({ character, onClose }: Props) {
  const { upsertCharacter } = useStoryStore();
  const [type, setType] = useState("traits");
  const [result, setResult] = useState("");
  const lastResult = useRef("");
  const transparency = useLLMTransparency();

  const typeLabel = ATTRIBUTE_TYPES.find((t) => t.value === type)?.label ?? type;

  const { sources: contextSources } = useLLMContextSources(
    { context_type: "attributes", character_id: character.id, attribute_type: type }
  );

  const { stream, text: streamingText, isStreaming: generating } = useLLMStream({
    requestId: `attributes:${character.id}:${type}`,
    label: `Generating ${typeLabel}`,
    onComplete: (full) => {
      setResult(full);
      lastResult.current = full;
      transparency.recordInteraction();
    },
    onError: () => setResult("⚠ Error generating suggestions."),
  });

  const displayText = generating ? streamingText : result;

  function generate() {
    setResult("");
    stream((signal) => api.generateAttributes(character.id, type, signal));
  }

  async function applyToField() {
    if (!result) return;
    const field = type === "traits" ? "arc_notes" : type === "backstory" ? "background" : type === "appearance" ? "appearance" : "personality";
    const existing = (character as Record<string, unknown>)[field] as string ?? "";
    const updated = await api.updateCharacter(character.id, {
      [field]: existing ? `${existing}\n\n[AI suggestions]:\n${result}` : result,
    });
    upsertCharacter(updated);
    onClose();
  }


  return (
    <>
    <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
    <div className={styles.panel}>
      <div className={styles.header}>
        <Sparkles size={14} className={styles.icon} />
        <span className={styles.title}>AI Attribute Suggestions</span>
        <LLMTransparencyTrigger
          disabled={!transparency.hasData}
          onClick={() => transparency.open(
            { context_type: "attributes", character_id: character.id, attribute_type: type },
            lastResult.current,
          )}
        />
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className={styles.controls}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={styles.select}
        >
          {ATTRIBUTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={generating}
          className={styles.generateBtn}
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>

      <LLMContextSources sources={contextSources} />

      {displayText && (
        <div className={styles.result}>
          <div className={styles.resultText}>{displayText}</div>
          {!generating && (
            <div className={styles.resultActions}>
              <button onClick={applyToField} className={styles.applyBtn}>
                Apply to {type === "traits" ? "arc notes" : type === "backstory" ? "background" : type === "appearance" ? "appearance" : "personality"}
              </button>
              <button onClick={generate} className={styles.regenerateBtn}>
                Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {!displayText && !generating && (
        <p className={styles.hint}>Select what to generate, then click Generate.</p>
      )}
    </div>
    </>
  );
}
