import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character } from "../../types";
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
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");

  async function generate() {
    setGenerating(true);
    setResult("");
    try {
      const res = await api.generateAttributes(character.id, type);
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
      setResult("⚠ Error generating suggestions.");
    } finally {
      setGenerating(false);
    }
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
    <div className={styles.panel}>
      <div className={styles.header}>
        <Sparkles size={14} className={styles.icon} />
        <span className={styles.title}>AI Attribute Suggestions</span>
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

      {result && (
        <div className={styles.result}>
          <div className={styles.resultText}>{result}</div>
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

      {!result && !generating && (
        <p className={styles.hint}>Select what to generate, then click Generate.</p>
      )}
    </div>
  );
}
