import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { answerWelcome, type UIMode } from "../../lib/mode";
import { toast } from "../../stores/toastStore";
import styles from "./WelcomeDialog.module.css";

const CHOICES: { mode: UIMode; label: string; text: string }[] = [
  {
    mode: "writer",
    label: "Just me and my writing",
    text: "Writer mode. No AI anywhere. The checks, counts and organizing still work, all on this computer.",
  },
  {
    mode: "studio",
    label: "With an Assistant to ask",
    text: "Studio mode. An AI you run yourself can answer questions about your story and read drafts. It never writes your prose. Needs a one-time setup.",
  },
];

/**
 * The first sign-in of a new account (doc 30 D4): do you want the Assistant? Asked once, with
 * nothing chosen for the writer; the answer is the account's mode, and Settings › Mode changes
 * it later. There is no way round it but to answer: until then the account shows no AI.
 */
export default function WelcomeDialog() {
  const [choice, setChoice] = useState<UIMode | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => first.current?.focus());
    // Keep Tab inside: the page behind waits for the answer.
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialog.current) return;
      const all = [...dialog.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)")];
      const at = all.indexOf(document.activeElement as HTMLElement);
      if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === all.length - 1)) {
        e.preventDefault();
        all[e.shiftKey ? all.length - 1 : 0]?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function go() {
    if (!choice) return;
    setSaving(true);
    try {
      await answerWelcome(choice);
    } catch {
      toast.error("That didn't save. Try again in a moment.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className={styles.overlay}>
      <div
        ref={dialog}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-lede"
      >
        <h1 id="welcome-title" className={styles.title}>
          Welcome to LoreStudio
        </h1>
        <p id="welcome-lede" className={styles.lede}>
          A place to write your story and keep everything about it in reach.
        </p>
        <fieldset className={styles.question}>
          <legend className={styles.legend}>
            <span className={styles.kicker}>Asked once. You can change it any time in Settings › Mode.</span>
            <span className={styles.ask}>Do you want the Assistant?</span>
          </legend>
          {CHOICES.map((c, i) => (
            <label key={c.mode} className={styles.choice} data-on={choice === c.mode || undefined}>
              <input
                ref={i === 0 ? first : undefined}
                type="radio"
                name="welcome-mode"
                value={c.mode}
                checked={choice === c.mode}
                onChange={() => setChoice(c.mode)}
              />
              <span className={styles.choiceText}>
                <span className={styles.choiceLabel}>{c.label}</span>
                <span className={styles.choiceHint}>{c.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.primary}
            disabled={!choice || saving}
            onClick={() => void go()}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
