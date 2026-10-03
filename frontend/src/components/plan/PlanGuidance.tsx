import { streamAnswer } from "../../lib/ai/eventStream";
import { useState, useRef, useEffect } from "react";
import { Orbit, X, Loader } from "lucide-react";
import { api } from "../../api/client";
import styles from "./PlanGuidance.module.css";
import { useAIAvailable } from "../../lib/mode";

interface Props {
  storyId: string;
  layer: string;
  content: string;
  characterId?: string | null;
  onClose: () => void;
}

export default function PlanGuidance({ storyId, layer, content, characterId, onClose }: Props) {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!content.trim()) {
      setText("");
      return;
    }
    fetchGuidance();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchGuidance() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setText("");

    try {
      const res = await api.getSnowflakeGuidance(
        storyId,
        layer,
        content,
        characterId,
        abortRef.current.signal,
      );
      if (!res.ok) {
        setError("Guidance request failed.");
        setLoading(false);
        return;
      }
      const { error: streamError } = await streamAnswer(res, setText);
      if (streamError) setError(streamError);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Connection error.");
    } finally {
      setLoading(false);
    }
  }

  if (!aiAvailable) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>
          <Orbit size={13} />
          Guidance
        </span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close guidance">
          <X size={14} />
        </button>
      </div>

      <div className={styles.body}>
        {!content.trim() && <p className={styles.hint}>Write something first, then request guidance.</p>}
        {content.trim() && loading && !text && (
          <div className={styles.loading}>
            <Loader size={14} className={styles.spinner} />
            Analyzing…
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {text && <div className={styles.response}>{text}</div>}
      </div>

      {content.trim() && !loading && (
        <button className={styles.retryBtn} onClick={fetchGuidance}>
          Ask again
        </button>
      )}
    </div>
  );
}
