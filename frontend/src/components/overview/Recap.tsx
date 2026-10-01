import { useRef, useState } from "react";
import { Compass, RefreshCw } from "lucide-react";
import { api } from "../../api/client";
import { streamAnswer } from "../../lib/ai/eventStream";
import styles from "./Overview.module.css";

/** "Remind me where I left off": an Assistant recap of the last session. Studio only. */
export default function Recap({ storyId }: { storyId: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function fetchRecap() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setDone(false);
    setLoading(true);
    try {
      const res = await api.recapLastSession(storyId, ctrl.signal);
      if (!res.body) throw new Error("No stream");
      const { error } = await streamAnswer(res, setText);
      if (error) setText(error);
      setDone(true);
    } catch {
      // An abort, or no model: nothing to show.
    } finally {
      setLoading(false);
    }
  }

  if (!text && !loading) {
    return (
      <button type="button" className={styles.recapTrigger} onClick={fetchRecap}>
        <Compass size={13} aria-hidden />
        Remind me where I left off
      </button>
    );
  }
  return (
    <div className={styles.recapCard}>
      <div className={styles.recapHead}>
        <Compass size={12} aria-hidden />
        <span className={styles.label} data-tone="ai">
          Last session
        </span>
        {done && (
          <button type="button" className={styles.iconBtn} onClick={fetchRecap} aria-label="Recap again">
            <RefreshCw size={11} />
          </button>
        )}
      </div>
      <p className={styles.recapText}>
        {text}
        {loading && <span className={styles.recapCursor} />}
      </p>
    </div>
  );
}
