import { useState } from "react";
import { Feather, Orbit } from "lucide-react";
import type { AssistantResult } from "../../../api/assistantResults";
import type { SessionContext } from "../../../lib/ai/sessionTypes";
import { formatRelative } from "../../../lib/utils";
import { useAIStore } from "../../../stores/aiStore";
import { usePanelStore } from "../../../stores/panelStore";
import { LLMTransparencyModal, LLMTransparencyTrigger } from "../../llm";
import styles from "./KeptAnswerBar.module.css";

/**
 * The header of a kept answer outside a sheet (A7): when it was asked, and the same four
 * actions as the sheet's band: Talk it over, Ask again, Clear and what was sent (ShieldCheck).
 * The answer stays until it is cleared or asked again, through a restart.
 */
export default function KeptAnswerBar({
  answer,
  heading,
  context,
  onAskAgain,
  asking = false,
  onClear,
}: {
  answer: AssistantResult;
  /** What the conversation is about, as its title says it. */
  heading: string;
  context: SessionContext;
  /** Runs the feature again; left out where asking again needs a choice first. */
  onAskAgain?: () => void;
  asking?: boolean;
  onClear: () => void;
}) {
  const [callId, setCallId] = useState<string | null>(null);
  const openResultSession = useAIStore((s) => s.openResultSession);

  return (
    <div className={styles.bar} role="group" aria-label="Kept answer">
      <span className={styles.when}>
        <Orbit size={13} aria-hidden />
        {asking ? "Asking again…" : `Kept · ${formatRelative(answer.updated_at)}`}
      </span>
      <span className={styles.spacer} />
      <button
        type="button"
        className={styles.talk}
        onClick={() => {
          openResultSession({ feature: answer.feature, heading, data: answer.data, context });
          usePanelStore.getState().openAssistant();
        }}
      >
        <Feather size={13} aria-hidden />
        Talk it over
      </button>
      {onAskAgain && (
        <button type="button" className={styles.quiet} disabled={asking} onClick={onAskAgain}>
          {asking ? "Asking…" : "Ask again"}
        </button>
      )}
      <button type="button" className={styles.quiet} disabled={asking} onClick={onClear}>
        Clear
      </button>
      <LLMTransparencyTrigger
        onClick={() => setCallId(answer.ai_call_log_id)}
        disabled={!answer.ai_call_log_id}
      />
      <LLMTransparencyModal
        isOpen={!!callId}
        onClose={() => setCallId(null)}
        data={callId ? { callId, response: "" } : null}
      />
    </div>
  );
}
