import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useMode } from "../../lib/mode";
import styles from "../../pages/Settings.module.css";

/**
 * "What leaves this machine." Every outbound connection the app can make, listed plainly.
 * The statement about telemetry must stay true: if a telemetry endpoint is ever added, it goes here first.
 */
export default function PrivacySection() {
  const mode = useMode();
  const [ollamaUrl, setOllamaUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getLLMSettings()
      .then((s) => {
        if (!cancelled) setOllamaUrl((s as { ollama_base_url?: string }).ollama_base_url ?? null);
      })
      .catch(() => {
        if (!cancelled) setOllamaUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.card}>
      <p className={styles.sectionHint}>
        LoreStudio runs on your machine. Your manuscript, notes and characters stay in its database. These are
        the only places data can be sent, and each is something you configured:
      </p>
      <ul className={styles.plainList}>
        <li>
          <strong>Ollama</strong> —{" "}
          {mode === "studio" ? (ollamaUrl ?? "not configured") : "not used in Writer mode"}.
          {mode === "studio" && (
            <>
              {" "}
              Receives the text each AI feature shows in its “What the AI sees” view. Nothing is sent unless
              you trigger an AI feature.
            </>
          )}
        </li>
        <li>
          <strong>Telemetry, analytics, update checks</strong> — none. The app makes no other network
          requests.
        </li>
      </ul>
      <p className={styles.sectionHint}>
        Every AI call is recorded in Chronicle › AI activity with its prompt and response. Every data change
        is recorded in Chronicle › Changes.
      </p>
    </div>
  );
}
