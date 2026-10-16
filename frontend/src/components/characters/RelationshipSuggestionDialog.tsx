import { useState, useEffect, useRef } from "react";
import { Users, Link } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../common";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import KeptAnswerBar from "../ai/kept/KeptAnswerBar";
import { useKeptAnswer } from "../ai/kept/useKeptAnswer";
import styles from "./RelationshipSuggestionDialog.module.css";
import { useAIAvailable } from "../../lib/mode";

const REL_SCHEMA: SectionConfig[] = [
  {
    key: "suggestions",
    label: "Suggested relationships",
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

/**
 * Relationship ideas for the whole cast. The answer is kept on the story (A7): opening this
 * again shows it, through a restart, and asks again only on Ask again, or the first time,
 * when nothing is kept.
 */
export default function RelationshipSuggestionDialog({ storyId, onClose }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const kept = useKeptAnswer({ storyId, type: "story", id: storyId }, "relationship-suggest");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await api.suggestRelationships(storyId);
      if (!r.success) setError(r.raw_text || "The Assistant could not answer just now.");
      else await kept.reload();
    } catch {
      setError("The Assistant could not answer just now.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!kept.loaded || kept.answer || started.current) return;
    started.current = true;
    queueMicrotask(() => void generate());
  });

  if (!aiAvailable) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Relationship Suggestions"
      icon={<Users size={15} />}
      size="md"
      footer={
        <button onClick={onClose} className={styles.closeFooterBtn}>
          Close
        </button>
      }
    >
      {kept.answer && (
        <KeptAnswerBar
          answer={kept.answer}
          heading="Relationship ideas for the cast"
          context={{ storyId }}
          onAskAgain={() => void generate()}
          asking={generating}
          onClear={() => void kept.clear()}
        />
      )}
      {(generating || !kept.loaded) && !kept.answer && (
        <p className={styles.generating}>Analyzing your characters…</p>
      )}
      {error && <p className={styles.generating}>{error}</p>}
      {kept.answer && (
        <StructuredResponseRenderer result={{ success: true, data: kept.answer.data }} schema={REL_SCHEMA} />
      )}
    </Modal>
  );
}
