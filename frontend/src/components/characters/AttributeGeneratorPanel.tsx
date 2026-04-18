import { useState, useRef } from "react";
import { Compass, X, Wand2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character, StructuredResult } from "../../types";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources } from "../llm";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
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
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const lastResultText = useRef("");
  const transparency = useLLMTransparency();

  const typeLabel = ATTRIBUTE_TYPES.find((t) => t.value === type)?.label ?? type;

  const ATTR_SCHEMA: SectionConfig[] = [
    { key: "suggestions", label: typeLabel, icon: Wand2, color: "var(--color-accent)", type: "sublist", labelField: "text", descField: "rationale" },
  ];

  const { sources: contextSources } = useLLMContextSources(
    { context_type: "attributes", character_id: character.id, attribute_type: type }
  );

  async function generate() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.generateAttributes(character.id, type);
      setResult(r);
      lastResultText.current = r.raw_text ?? JSON.stringify(r.data) ?? "";
      transparency.recordInteraction();
    } catch {
      setResult({ success: false, raw_text: "⚠ Error generating suggestions." });
    } finally {
      setGenerating(false);
    }
  }

  async function applyToField() {
    if (!result) return;
    // Extract suggestion text from structured data or raw text
    let text = "";
    if (result.success && result.data) {
      const suggestions = result.data.suggestions as Array<{ text: string }> | undefined;
      if (suggestions?.length) {
        text = suggestions.map((s) => s.text).join("\n");
      }
    }
    if (!text) text = result.raw_text ?? "";
    if (!text) return;

    const field = type === "traits" ? "arc_notes" : type === "backstory" ? "background" : type === "appearance" ? "appearance" : "personality";
    const existing = (character as unknown as Record<string, string>)[field] ?? "";
    const updated = await api.updateCharacter(character.id, {
      [field]: existing ? `${existing}\n\n[AI suggestions]:\n${text}` : text,
    });
    upsertCharacter(updated);
    onClose();
  }

  return (
    <>
      <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <Compass size={14} className={styles.icon} />
          <span className={styles.title}>AI Attribute Suggestions</span>
          <LLMTransparencyTrigger
            disabled={!transparency.hasData}
            onClick={() => transparency.open(
              { context_type: "attributes", character_id: character.id, attribute_type: type },
              lastResultText.current,
            )}
          />
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className={styles.controls}>
          <select value={type} onChange={(e) => setType(e.target.value)} className={styles.select}>
            {ATTRIBUTE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button onClick={generate} disabled={generating} className={styles.generateBtn}>
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>

        <LLMContextSources sources={contextSources} />

        {generating && <p className={styles.hint}>Generating suggestions…</p>}

        {!generating && result && (
          <div className={styles.result}>
            <StructuredResponseRenderer result={result} schema={ATTR_SCHEMA} />
            <div className={styles.resultActions}>
              <button onClick={applyToField} className={styles.applyBtn}>
                Apply to {type === "traits" ? "arc notes" : type === "backstory" ? "background" : type === "appearance" ? "appearance" : "personality"}
              </button>
              <button onClick={generate} className={styles.regenerateBtn}>
                Regenerate
              </button>
            </div>
          </div>
        )}

        {!generating && !result && (
          <p className={styles.hint}>Select what to generate, then click Generate.</p>
        )}
      </div>
    </>
  );
}
