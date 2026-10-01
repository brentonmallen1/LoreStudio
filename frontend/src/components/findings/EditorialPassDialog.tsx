import { useRef, useState } from "react";
import { Compass, Square } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import Modal from "../common/Modal";
import { ContextLevelSelector, type ContextLevel } from "./ContextLevelSelector";
import { ScopeSelector, type ScopeSelection } from "./ScopeSelector";
import styles from "./Findings.module.css";

/** Why an editorial pass failed, in words an author can act on. */
function explain(msg: string): string {
  if (msg.includes("No written content")) return "Nothing is written in that scope yet.";
  if (msg.includes("context window") || msg.includes("context_length"))
    return "That is more than the model can read at once. Try “With summaries”, or a smaller scope.";
  if (msg.includes("timeout") || msg.includes("timed out"))
    return "The model took too long. Try a smaller scope.";
  if (msg.includes("connect") || msg.includes("fetch")) return "Could not reach the model. Is it running?";
  return msg || "Something went wrong.";
}

/**
 * The editorial pass: five readings in one run, so it asks how much to read and of what
 * first (doc 12 P4; it was the Story Health "Editor" tab). Its findings join the feed; its
 * notes go into the prose as before; the whole report is in the Chronicle.
 */
export default function EditorialPassDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const structure = useStoryStore((s) => s.structure);
  const [contextLevel, setContextLevel] = useState<ContextLevel>("summaries");
  const [scope, setScope] = useState<ScopeSelection>({ type: "story", ids: [] });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run() {
    if (!storyId) return;
    setError(null);
    setRunning(true);
    abort.current = new AbortController();
    try {
      await api.runEditorialPass(storyId, contextLevel, scope.type, scope.ids, abort.current.signal);
      onDone();
      onClose();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(explain(e instanceof Error ? e.message : ""));
    } finally {
      setRunning(false);
      abort.current = null;
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => (running ? abort.current?.abort() : onClose())}
      title="Editorial pass"
      icon={<Compass size={16} />}
      footer={
        <div className={styles.dialogFooter}>
          {error && <span className={styles.dialogError}>{error}</span>}
          {running ? (
            <button type="button" className={styles.aiButton} onClick={() => abort.current?.abort()}>
              <Square size={13} aria-hidden /> Cancel
            </button>
          ) : (
            <button type="button" className={styles.aiButton} onClick={run}>
              <Compass size={13} aria-hidden /> Run the editorial pass
            </button>
          )}
        </div>
      }
    >
      <p className={styles.dialogLead}>
        Fresh eyes, revision priorities, intent against execution, voice and margin notes. It takes a while;
        the findings land in the list, the notes in the prose, the whole report in the Chronicle.
      </p>
      <div className={styles.dialogFields}>
        <ContextLevelSelector value={contextLevel} onChange={setContextLevel} />
        <ScopeSelector structure={structure} value={scope} onChange={setScope} />
      </div>
    </Modal>
  );
}
