import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAIAvailable } from "../../lib/mode";
import { aiCallsApi } from "../../api/aiCalls";
import styles from "../../pages/Settings.module.css";

/**
 * "What leaves this machine." Every outbound connection the app can make, listed plainly.
 * The statement about telemetry must stay true: if a telemetry endpoint is ever added, it goes here first.
 */
export default function PrivacySection() {
  const aiAvailable = useAIAvailable();
  const [ollamaUrl, setOllamaUrl] = useState<string | null>(null);
  const [purged, setPurged] = useState<number | null>(null);
  const [purging, setPurging] = useState(false);

  async function purge() {
    if (
      !window.confirm(
        "Delete every stored AI prompt and response? The record that each call happened is kept.",
      )
    ) {
      return;
    }
    setPurging(true);
    try {
      setPurged((await aiCallsApi.purgePayloads()).removed);
    } finally {
      setPurging(false);
    }
  }

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
          <strong>Ollama</strong>:{" "}
          {aiAvailable ? (ollamaUrl ?? "not configured") : "not contacted (AI is off)"}.
          {aiAvailable && (
            <>
              {" "}
              Receives the text each AI feature shows in its “What the AI sees” view. Nothing is sent unless
              you trigger an AI feature.
            </>
          )}
        </li>
        <li>
          <strong>Telemetry, analytics, update checks</strong>: none. The app makes no other network requests.
        </li>
      </ul>
      <p className={styles.sectionHint}>
        Every AI call is recorded in Chronicle › AI activity: the prompt, the messages, the options sent and
        the raw response, including calls that failed or that you stopped. Every data change is recorded in
        Chronicle › Changes.
      </p>
      <p className={styles.sectionHint}>
        Prompts and responses are kept for the number of days set by <code>AI_PAYLOAD_RETENTION_DAYS</code>{" "}
        (90 by default), then pruned automatically. The summary of each call (feature, model, tokens, status)
        is kept, so the history of what ran stays complete either way.
      </p>
      <button className={styles.dangerBtn} onClick={purge} disabled={purging}>
        {purging ? "Deleting…" : "Delete stored prompts and responses now"}
      </button>
      {purged !== null && (
        <p className={styles.sectionHint}>
          Deleted {purged} stored {purged === 1 ? "payload" : "payloads"}.
        </p>
      )}
    </div>
  );
}
