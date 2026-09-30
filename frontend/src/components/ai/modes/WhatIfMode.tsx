import { Shuffle } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import MentionComposer from "../shared/MentionComposer";
import styles from "./AssistantMode.module.css";

const EXAMPLE_PROMPTS = [
  "What if I killed the main antagonist in the first act?",
  "What if two characters swapped their roles?",
  "What if the inciting incident never happened?",
  "What if the protagonist failed at the midpoint?",
  "What if a supporting character was the real villain?",
];

interface Props {
  session: AISession;
}

export default function WhatIfMode({ session }: Props) {
  const state = useAIModeState(session);
  const { sendMessage, cancelStreaming } = useAIStore();
  const storyId = session.context.storyId ?? "";

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    state.lastUserMsg.current = content;
    sendMessage(session.id, content, undefined, state.sessionParams);
    state.setInput("");
  }

  return (
    <AIModeWrapper session={session} state={state} icon={Shuffle} title="What If?">
      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <Shuffle size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>What If?</p>
          <p className={styles.emptyHint}>
            {storyId
              ? "Explore how a single change could ripple through your characters, plot threads, and themes."
              : "Add a story to context before exploring what-if scenarios."}
          </p>
          {storyId && (
            <div className={styles.starters}>
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  className={styles.starterBtn}
                  onClick={() => handleSend(p)}
                  disabled={session.isStreaming}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <MessageList
          messages={session.messages}
          streamingText={session.streamingText}
          streamingThinking={session.streamingThinking}
          isStreaming={session.isStreaming}
          emptyText="Ask a 'What if?' question to explore scenario ripples."
        />
      )}

      <MentionComposer
        sessionId={session.id}
        value={state.input}
        onChange={state.setInput}
        onSend={() => handleSend()}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming || !storyId}
        placeholder={session.messages.length > 0 ? "Ask a follow-up…" : "What if…"}
      />
    </AIModeWrapper>
  );
}
