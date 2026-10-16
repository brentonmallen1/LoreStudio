import { useId } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAssistantReady } from "../../../lib/ai/assistantReady";
import styles from "./SetupAssistantCard.module.css";

const GUIDE = "/guides/setting-up-the-assistant";

/**
 * "Set up the Assistant" (doc 30 D4): what a Studio writer sees where an Assistant action would
 * have failed for want of a model. Ollama in plain words, the model to get, Check again, and
 * the step-by-step guide. The two lines say what the last check found, each a shape and words.
 *
 * `onDone` closes the dialog it sits in once the check comes back ready.
 */
export default function SetupAssistantCard({
  onDone,
  compact = false,
  titled = true,
}: {
  onDone?: () => void;
  /** In a narrow place (the side panel): the steps stack under the status. */
  compact?: boolean;
  /** Its own heading; a dialog that carries the title leaves it out. */
  titled?: boolean;
}) {
  const titleId = useId();
  const { status, check, recheck } = useAssistantReady();
  const model = check?.model || "gemma4";
  const running = Boolean(check?.connected);
  const listed = Boolean(check?.modelListed);
  const ready = status === "ready";
  const checking = status === "checking";

  return (
    <section
      className={styles.card}
      data-compact={compact || undefined}
      data-assistant-setup
      aria-labelledby={titled ? titleId : undefined}
      aria-label={titled ? undefined : "Set up the Assistant"}
    >
      <div className={styles.about}>
        {titled && (
          <>
            <span className={styles.kicker}>{ready ? "Ready" : "Before the Assistant can answer"}</span>
            <h2 id={titleId} className={styles.title}>
              {ready ? "The Assistant is set up" : "Set up the Assistant"}
            </h2>
          </>
        )}
        <p className={styles.text}>
          The Assistant runs on your own computer through a free program called <strong>Ollama</strong>, so
          your story never leaves it. Setting it up takes about ten minutes.
        </p>
        <ol className={styles.steps}>
          <li>Install Ollama from ollama.com and open it.</li>
          <li>
            Choose a model. We suggest <strong>{model}</strong>
            {model === "gemma4" ? ": it fits most laptops with 16 GB of memory" : ""}. In a terminal, run{" "}
            <code>ollama pull {model}</code>.
          </li>
          <li>
            Come back here and press <strong>Check again</strong>.
          </li>
        </ol>
      </div>
      <div className={styles.side}>
        <ul className={styles.status} aria-live="polite">
          <li className={styles.state} data-state={running ? "ok" : "missing"}>
            <span className={styles.mark} aria-hidden />
            {running ? "Ollama is running" : "Ollama isn't running yet"}
          </li>
          <li className={styles.state} data-state={listed ? "ok" : running ? "missing" : "waiting"}>
            <span className={styles.mark} aria-hidden />
            {listed ? `${model} is ready` : running ? `${model} isn't downloaded yet` : "No model yet"}
          </li>
        </ul>
        <div className={styles.actions}>
          {ready && onDone ? (
            <button type="button" className={styles.check} onClick={onDone}>
              Done
            </button>
          ) : (
            <button type="button" className={styles.check} disabled={checking} onClick={() => void recheck()}>
              {checking && <Loader2 size={13} className={styles.spin} aria-hidden />}
              {checking ? "Checking…" : "Check again"}
            </button>
          )}
          <Link to={GUIDE} className={styles.guide} onClick={onDone}>
            Step-by-step guide
          </Link>
        </div>
        <p className={styles.note}>
          Ollama on another computer, or in Docker? Give its address in{" "}
          <Link to="/settings#ai" onClick={onDone}>
            Settings › AI / LLM
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
