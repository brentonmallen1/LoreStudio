import { useState, useEffect, useRef } from "react";
import { FoldVertical, Layers } from "lucide-react";
import { api } from "../../../api/client";
import { Modal } from "../../common";
import type { ChatMessage } from "../../../types";
import styles from "./SummarizePreviewModal.module.css";

const KEEP_RECENT_DEFAULT = 4;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  storyId?: string;
  onApply: (summary: string, keepRecent: number) => void;
}

export default function SummarizePreviewModal({ isOpen, onClose, messages, storyId, onApply }: Props) {
  const [summary, setSummary] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [keepRecent, setKeepRecent] = useState(KEEP_RECENT_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch summary when modal opens
  useEffect(() => {
    if (!isOpen || messages.length === 0) return;
    setSummary("");
    setError(null);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Send all messages except the ones we'll keep
    const toSummarize = messages.slice(0, Math.max(0, messages.length - keepRecent));

    api.summarizeConversation(toSummarize, storyId, ctrl.signal)
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setError("Failed to generate summary.");
          setStreaming(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setSummary(full);
        }
        setStreaming(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError("Failed to generate summary.");
          setStreaming(false);
        }
      });

    return () => {
      ctrl.abort();
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    abortRef.current?.abort();
    onClose();
  }

  function handleApply() {
    if (!summary.trim()) return;
    onApply(summary.trim(), keepRecent);
    onClose();
  }

  const messagesToSummarize = Math.max(0, messages.length - keepRecent);
  const footer = (
    <div className={styles.footer}>
      <button className={styles.cancelBtn} onClick={handleClose}>
        Cancel
      </button>
      <button
        className={styles.applyBtn}
        onClick={handleApply}
        disabled={!summary.trim() || streaming}
      >
        Apply Summary
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Summarize Conversation"
      icon={<FoldVertical size={15} />}
      size="md"
      footer={footer}
    >
      <div className={styles.body}>
        <p className={styles.description}>
          {messagesToSummarize > 0
            ? `${messagesToSummarize} older message${messagesToSummarize !== 1 ? "s" : ""} will be replaced with this summary. The ${keepRecent} most recent messages are kept verbatim.`
            : "All messages will be replaced with this summary."}
        </p>

        <div className={styles.keepRow}>
          <label className={styles.keepLabel}>Keep most recent</label>
          <select
            className={styles.keepSelect}
            value={keepRecent}
            onChange={(e) => setKeepRecent(Number(e.target.value))}
          >
            {[0, 2, 4, 6, 8].map((n) => (
              <option key={n} value={n}>{n === 0 ? "None" : `${n} messages`}</option>
            ))}
          </select>
        </div>

        <div className={styles.previewBox}>
          <div className={styles.previewHeader}>
            <Layers size={12} />
            <span>Summary preview</span>
          </div>
          {error ? (
            <p className={styles.errorText}>{error}</p>
          ) : (
            <pre className={styles.previewText}>
              {summary || (streaming ? "Generating…" : "No summary yet.")}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
}
