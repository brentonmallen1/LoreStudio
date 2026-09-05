import { useState, useEffect, useRef } from "react";
import { Wand2, RefreshCw, Check } from "lucide-react";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { useStoryStore } from "../../../stores/storyStore";
import { api } from "../../../api/client";
import type { StructuredResult } from "../../../types";
import AIModeWrapper from "../AIModeWrapper";
import StructuredResponseRenderer, { type SectionConfig } from "../StructuredResponseRenderer";
import styles from "./AttributeGeneratorMode.module.css";

const ATTRIBUTE_TYPES = [
  { value: "traits", label: "Traits", field: "arc_notes", fieldLabel: "arc notes" },
  { value: "backstory", label: "Backstory elements", field: "background", fieldLabel: "background" },
  { value: "quirks", label: "Quirks & mannerisms", field: "personality", fieldLabel: "personality" },
  { value: "appearance", label: "Appearance", field: "appearance", fieldLabel: "appearance" },
];

interface Props {
  session: AISession;
}

export default function AttributeGeneratorMode({ session }: Props) {
  const state = useAIModeState(session);
  const { characters, upsertCharacter } = useStoryStore();
  const [type, setType] = useState(session.context.attributeType ?? "traits");
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const ranRef = useRef(false);

  const { characterId } = session.context;
  const typeConfig = ATTRIBUTE_TYPES.find((t) => t.value === type) ?? ATTRIBUTE_TYPES[0];

  const schema: SectionConfig[] = [
    {
      key: "suggestions",
      label: typeConfig.label,
      icon: Wand2,
      color: "var(--color-ai)",
      type: "sublist",
      labelField: "text",
      descField: "rationale",
    },
  ];

  async function generate() {
    if (!characterId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const r = await api.generateAttributes(characterId, type);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function applyToField() {
    if (!result || !characterId) return;
    let text = "";
    if (result.success && result.data) {
      const suggestions = (result.data as { suggestions?: Array<{ text: string }> }).suggestions;
      if (suggestions?.length) {
        text = suggestions.map((s) => s.text).join("\n");
      }
    }
    if (!text) text = result.raw_text ?? "";
    if (!text) return;

    const char = characters.find((c) => c.id === characterId);
    const existing = ((char ?? {}) as Record<string, string>)[typeConfig.field] ?? "";
    const newValue = existing ? `${existing}\n\n[AI suggestions]:\n${text}` : text;
    const updated = await api.updateCharacter(characterId, { [typeConfig.field]: newValue });
    upsertCharacter(updated);
    setApplied(true);
  }

  // Auto-run on mount
  useEffect(() => {
    if (ranRef.current) return;
    if (!characterId) return;
    ranRef.current = true;
    generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset applied state when type changes
  useEffect(() => {
    setApplied(false);
  }, [type]);

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Wand2}
      title="Attribute Suggestions"
      hideTokenBadge
      hideSettings
    >
      {/* Type + regenerate controls */}
      <div className={styles.controls}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={styles.select}
          disabled={loading}
        >
          {ATTRIBUTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={loading || !characterId}
          className={styles.generateBtn}
          title="Generate new suggestions"
        >
          <RefreshCw size={12} className={loading ? styles.spin : undefined} />
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className={styles.loading}>
          <RefreshCw size={18} className={styles.spinner} />
          <p>Generating {typeConfig.label.toLowerCase()}…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryBtn} onClick={generate}>
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className={styles.results}>
          <StructuredResponseRenderer result={result} schema={schema} />
          <div className={styles.applyRow}>
            <button
              onClick={applyToField}
              disabled={applied || !result.success}
              className={`${styles.applyBtn} ${applied ? styles.applyBtnDone : ""}`}
              title={`Append suggestions to the ${typeConfig.fieldLabel} field`}
            >
              {applied ? (
                <>
                  <Check size={12} /> Applied to {typeConfig.fieldLabel}
                </>
              ) : (
                <>Apply to {typeConfig.fieldLabel}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state — shown only if auto-run hasn't fired yet */}
      {!loading && !result && !error && (
        <div className={styles.empty}>
          <Wand2 size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Attribute Suggestions</p>
          <p className={styles.emptyHint}>
            Select a category and click Generate to get AI-powered suggestions grounded in this character's
            existing profile.
          </p>
        </div>
      )}
    </AIModeWrapper>
  );
}
