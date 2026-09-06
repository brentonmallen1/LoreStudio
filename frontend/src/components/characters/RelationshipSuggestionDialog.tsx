import { useState, useEffect, useRef } from "react";
import { Users, Link } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../common";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { LLMTransparencyModal, LLMTransparencyTrigger } from "../llm";
import type { StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import styles from "./RelationshipSuggestionDialog.module.css";
import { useAIAvailable } from "../../lib/mode";

const REL_SCHEMA: SectionConfig[] = [
  {
    key: "suggestions",
    label: "Suggested Relationships",
    icon: Link,
    color: "var(--color-ai)",
    type: "sublist",
    labelField: "character_a",
    descField: "description",
  },
];

interface Props {
  storyId: string;
  onClose: () => void;
  onRelationshipCreated?: () => void;
}

export default function RelationshipSuggestionDialog({ storyId, onClose }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const lastResultText = useRef("");
  const transparency = useLLMTransparency();

  useEffect(() => {
    generate();
  }, []);

  async function generate() {
    setResult(null);
    setGenerating(true);
    try {
      const r = await api.suggestRelationships(storyId);
      setResult(r);
      lastResultText.current = r.raw_text ?? JSON.stringify(r.data) ?? "";
      transparency.recordInteraction();
    } catch {
      setResult({ success: false, raw_text: "⚠ Error generating suggestions." });
    } finally {
      setGenerating(false);
    }
  }

  const footer = (
    <>
      <LLMTransparencyTrigger
        disabled={!transparency.hasData}
        onClick={() =>
          transparency.open({ context_type: "relationships", story_id: storyId }, lastResultText.current, {
            feature: "relationship-suggest",
            story_id: storyId,
          })
        }
        size="md"
      />
      <button onClick={generate} disabled={generating} className={styles.regenBtn}>
        {generating ? "Generating…" : "Regenerate"}
      </button>
      <button onClick={onClose} className={styles.closeFooterBtn}>
        Close
      </button>
    </>
  );

  if (!aiAvailable) return null;

  return (
    <>
      <LLMTransparencyModal
        isOpen={transparency.isOpen}
        onClose={transparency.close}
        data={transparency.data}
      />
      <Modal
        isOpen
        onClose={onClose}
        title="Relationship Suggestions"
        icon={<Users size={15} />}
        size="md"
        footer={footer}
      >
        {generating && <p className={styles.generating}>Analyzing your characters…</p>}
        {!generating && result && <StructuredResponseRenderer result={result} schema={REL_SCHEMA} />}
      </Modal>
    </>
  );
}
