import { useState, useEffect } from "react";
import { X, Users } from "lucide-react";
import { api } from "../../api/client";
import styles from "./RelationshipSuggestionDialog.module.css";

interface Props {
  storyId: string;
  onClose: () => void;
  onRelationshipCreated?: () => void;
}

export default function RelationshipSuggestionDialog({ storyId, onClose, onRelationshipCreated }: Props) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    generate();
  }, []);

  async function generate() {
    setGenerating(true);
    setResult("");
    try {
      const res = await api.suggestRelationships(storyId);
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

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <Users size={15} className={styles.icon} />
          <h2 className={styles.title}>Relationship Suggestions</h2>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          {generating && !result && (
            <p className={styles.generating}>Analyzing your characters…</p>
          )}
          {result && (
            <div className={styles.result}>{result}</div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={generate} disabled={generating} className={styles.regenBtn}>
            {generating ? "Generating…" : "Regenerate"}
          </button>
          <button onClick={onClose} className={styles.closeFooterBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
