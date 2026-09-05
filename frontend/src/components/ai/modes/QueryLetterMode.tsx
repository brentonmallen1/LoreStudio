import { Feather } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./AssistantMode.module.css";

const STARTERS = [
  "Draft a full query letter",
  "Help me write a stronger hook",
  "Draft just the story summary paragraph",
  "Suggest comparable titles I could use",
  "What's missing from my query letter?",
];

interface Props {
  session: AISession;
}

export default function QueryLetterMode({ session }: Props) {
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
    <AIModeWrapper session={session} state={state} icon={Feather} title="Query Letter">
      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <Feather size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Query Letter</p>
          <p className={styles.emptyHint}>
            {storyId
              ? "Draft and refine a professional query letter following genre conventions — hook, summary, comps, and bio placeholder."
              : "Add a story to context to draft a query letter."}
          </p>
          {storyId && (
            <div className={styles.starters}>
              {STARTERS.map((p) => (
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
          isStreaming={session.isStreaming}
          emptyText="Ask for a full letter, or start with the hook."
        />
      )}

      <ChatInput
        value={state.input}
        onChange={state.setInput}
        onSend={() => handleSend()}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming || !storyId}
        placeholder={session.messages.length > 0 ? "Refine the letter…" : "Draft a query letter…"}
      />
    </AIModeWrapper>
  );
}
