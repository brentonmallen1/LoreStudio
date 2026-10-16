import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { setAIEnabled, useAIAvailable } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

/**
 * The AI master switch (doc 06 §7). The context ceiling, the jobs' cool-down and whether the
 * model answers several requests at once are in Settings › Advanced (`ModelSharingFields`).
 *
 * Off is not cosmetic: every AI surface disappears and the gateway refuses calls, so a
 * stale tab or a keyboard shortcut cannot reach a model after you have said no.
 */
export default function AISwitchCard() {
  const available = useAIAvailable();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getAISettings()
      .then((s) => live && setEnabled(s.enabled))
      .catch(() => live && setEnabled(true));
    return () => {
      live = false;
    };
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      await setAIEnabled(next);
      setEnabled(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className={styles.sectionHint}>
        New to this? <Link to="/guides/setting-up-the-assistant">Setting up the Assistant</Link> explains
        Ollama in plain words, step by step.
      </p>
      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>
            <input
              type="checkbox"
              checked={enabled ?? true}
              disabled={enabled === null || saving}
              onChange={(e) => toggle(e.target.checked)}
            />{" "}
            Use AI features
          </label>
          <p className={styles.sectionHint}>
            {enabled === false
              ? "AI is off. No AI surface is shown anywhere, and the server refuses AI calls even if one is requested. Your manuscript tools, checks and exports are unaffected."
              : "When this is off, every AI surface disappears and the server refuses AI calls. Non-AI tools (checks, quote normalisation, NLP analyses, export) keep working."}
            {available ? "" : " Writer mode also hides AI; this switch is separate."}
          </p>
        </div>
      </div>
    </>
  );
}
