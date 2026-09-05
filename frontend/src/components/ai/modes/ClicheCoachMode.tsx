import { useState, useEffect, useRef } from "react";
import { Feather } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./ClicheCoachMode.module.css";

const DIRECTION_PRESETS = ["Freshen it", "Subvert it", "Keep it"] as const;

interface Props {
  session: AISession;
}

export default function ClicheCoachMode({ session }: Props) {
  const state = useAIModeState(session);
  const { sendMessage, cancelStreaming } = useAIStore();
  const [direction, setDirection] = useState<string | null>(null);
  const autoSentRef = useRef(false);

  // Auto-send initial request once when session has selected text and no messages
  useEffect(() => {
    if (autoSentRef.current) return;
    if (session.messages.length > 0) {
      autoSentRef.current = true;
      return;
    }
    if (!session.context.selectedText) return;

    autoSentRef.current = true;
    const content = `I'd like to discuss this passage:\n\n"${session.context.selectedText}"`;
    sendMessage(session.id, content);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    sendMessage(session.id, content, undefined, state.sessionParams);
    state.setInput("");
  }

  function handleDirectionStart(d: string) {
    if (session.isStreaming) return;
    autoSentRef.current = true;
    const selectedText = session.context.selectedText ?? "";
    const content = `I'd like to discuss this passage:\n\n"${selectedText}"\n\nMy goal: ${d}.`;
    sendMessage(session.id, content, undefined, state.sessionParams);
  }

  const selectedText = session.context.selectedText;
  const hasMessages = session.messages.length > 0 || session.isStreaming;

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Feather}
      title="Cliche Coach"
      hideTokenBadge
      hideSettings
      headerExtra={
        selectedText && (
          <span className={styles.passageChip} title={selectedText}>
            "{selectedText.length > 40 ? selectedText.slice(0, 40) + "…" : selectedText}"
          </span>
        )
      }
    >
      {/* Direction chips — shown before first send when there's selected text */}
      {!hasMessages && selectedText && (
        <div className={styles.directionSection}>
          <p className={styles.directionLabel}>What's your goal with this passage?</p>
          <div className={styles.chipGroup}>
            {DIRECTION_PRESETS.map((d) => (
              <button
                key={d}
                className={`${styles.chip} ${direction === d ? styles.chipActive : ""}`}
                onClick={() => setDirection((prev) => (prev === d ? null : d))}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            className={styles.startBtn}
            onClick={() => handleDirectionStart(direction ?? "Understand the clichés")}
            disabled={session.isStreaming}
          >
            <Feather size={13} />
            Discuss with Coach
          </button>
        </div>
      )}

      {/* Empty state when no selected text */}
      {!hasMessages && !selectedText && (
        <div className={styles.empty}>
          <Feather size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Cliche Coach</p>
          <p className={styles.emptyHint}>
            Select a passage in your scene and click Cliche to discuss it with your coach.
          </p>
        </div>
      )}

      {hasMessages && (
        <MessageList
          messages={session.messages}
          streamingText={session.streamingText}
          isStreaming={session.isStreaming}
        />
      )}

      {hasMessages && (
        <ChatInput
          value={state.input}
          onChange={state.setInput}
          onSend={() => handleSend()}
          onCancel={() => cancelStreaming(session.id)}
          disabled={session.isStreaming}
          placeholder="Continue the conversation…"
        />
      )}
    </AIModeWrapper>
  );
}
