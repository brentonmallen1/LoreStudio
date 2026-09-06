import { useEffect, useState } from "react";
import { AlertTriangle, Copy, ShieldCheck } from "lucide-react";
import { aiCallsApi, type AICall } from "../../api/aiCalls";
import { AI_FEATURE_CLASS_DESCRIPTIONS, type AIFeatureClass } from "../../lib/ai/features.generated";
import styles from "./AICallDetail.module.css";

const TABS = ["Prompt", "Response", "Thinking", "Options", "Context"] as const;
type Tab = (typeof TABS)[number];

/** Statuses worth showing plainly. "ok" needs no announcement. */
const STATUS_TEXT: Record<string, string> = {
  error: "This call failed",
  cancelled: "You stopped this call",
  "schema-fallback": "The model would not take the response schema — the answer was unconstrained",
  "invalid-json": "The response was not valid JSON",
  "schema-invalid": "The response did not match the expected shape",
};

function asMarkdown(call: AICall): string {
  const p = call.payload;
  const lines = [
    `# ${call.feature_label}`,
    `${call.model ?? "unknown model"} · ${call.status} · ${call.tokens_in ?? "?"}↑ ${call.tokens_out ?? "?"}↓ tokens`,
    "",
  ];
  if (p) {
    lines.push("## System prompt", "", p.system_prompt, "");
    for (const m of p.messages) lines.push(`## ${m.role}`, "", m.content, "");
    lines.push("## Response", "", p.raw_response, "");
    lines.push("## Options", "", "```json", JSON.stringify(p.options, null, 2), "```");
  }
  return lines.join("\n");
}

/**
 * Everything recorded about one AI call. This is what the transparency trigger opens:
 * the call that happened, not a preview rebuilt afterwards that might differ from it.
 */
export default function AICallDetail({ logId }: { logId: string }) {
  const [call, setCall] = useState<AICall | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("Prompt");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    aiCallsApi
      .get(logId)
      .then((c) => live && setCall(c))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [logId]);

  if (error) return <p className={styles.note}>This call could not be loaded.</p>;
  if (!call) return <p className={styles.note}>Loading…</p>;

  const payload = call.payload;
  const statusNote = STATUS_TEXT[call.status];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <ShieldCheck size={13} className={styles.headIcon} />
        <span className={styles.feature}>{call.feature_label}</span>
        {call.classification && (
          <span
            className={styles.classChip}
            title={AI_FEATURE_CLASS_DESCRIPTIONS[call.classification as AIFeatureClass]}
          >
            {call.classification}
          </span>
        )}
        <span className={styles.spacer} />
        <button
          className={styles.copyBtn}
          onClick={() => {
            navigator.clipboard?.writeText(asMarkdown(call));
            setCopied(true);
          }}
        >
          <Copy size={12} /> {copied ? "Copied" : "Copy as Markdown"}
        </button>
      </div>

      {statusNote && (
        <p className={styles.status}>
          <AlertTriangle size={12} /> {statusNote}
          {payload?.error ? `: ${payload.error}` : ""}
        </p>
      )}

      {!payload ? (
        <p className={styles.note}>
          The prompt and response for this call are no longer stored. The record of the call is kept; the text
          is pruned on the schedule in Settings › Privacy.
        </p>
      ) : (
        <>
          <div className={styles.tabs} role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Prompt" && (
            <div className={styles.body}>
              <p className={styles.role}>System</p>
              <pre className={styles.pre}>{payload.system_prompt || "(none)"}</pre>
              {payload.messages.map((m, i) => (
                <div key={i}>
                  <p className={styles.role}>{m.role}</p>
                  <pre className={styles.pre}>{m.content}</pre>
                </div>
              ))}
            </div>
          )}
          {tab === "Response" && <pre className={styles.pre}>{payload.raw_response || "(empty)"}</pre>}
          {tab === "Thinking" && (
            <pre className={styles.pre}>{payload.thinking || "This call did not return any reasoning."}</pre>
          )}
          {tab === "Options" && <pre className={styles.pre}>{JSON.stringify(payload.options, null, 2)}</pre>}
          {tab === "Context" && (
            <div className={styles.body}>
              {payload.context_sources.length === 0 ? (
                <p className={styles.note}>
                  Context provenance arrives with the assembler; for now the prompt tab shows everything that
                  was sent.
                </p>
              ) : (
                <ul className={styles.sources}>
                  {payload.context_sources.map((s, i) => (
                    <li key={i}>
                      <strong>{s.label}</strong> {s.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
