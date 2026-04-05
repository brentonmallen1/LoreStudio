import { useState, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../common";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { LLMTransparencyModal, LLMTransparencyTrigger } from "../llm";
import styles from "./RelationshipSuggestionDialog.module.css";

interface Props {
  storyId: string;
  onClose: () => void;
  onRelationshipCreated?: () => void;
}

export default function RelationshipSuggestionDialog({ storyId, onClose }: Props) {
  const [result, setResult] = useState("");
  const lastResult = useRef("");
  const transparency = useLLMTransparency();

  const { stream, text: streamingText, isStreaming: generating } = useLLMStream({
    requestId: `relationships:${storyId}`,
    label: "Analyzing relationships",
    tabId: "characters",
    onComplete: (full) => {
      setResult(full);
      lastResult.current = full;
      transparency.recordInteraction();
    },
    onError: () => setResult("⚠ Error generating suggestions."),
  });

  const displayText = generating ? streamingText : result;

  useEffect(() => {
    generate();
  }, []);

  function generate() {
    setResult("");
    stream((signal) => api.suggestRelationships(storyId, signal));
  }

  const footer = (
    <>
      <LLMTransparencyTrigger
        disabled={!transparency.hasData}
        onClick={() => transparency.open({ context_type: "relationships", story_id: storyId }, lastResult.current)}
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

  return (
    <>
    <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
    <Modal
      isOpen
      onClose={onClose}
      title="Relationship Suggestions"
      icon={<Users size={15} />}
      size="md"
      footer={footer}
    >
      {generating && !displayText && (
        <p className={styles.generating}>Analyzing your characters…</p>
      )}
      {displayText && (
        <div className={styles.result}>{displayText}</div>
      )}
    </Modal>
    </>
  );
}
