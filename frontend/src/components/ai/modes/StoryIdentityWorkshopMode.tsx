import { Map } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./AssistantMode.module.css";

const EXAMPLE_PROMPTS = [
  "Help me figure out what my story is really about",
  "I know the plot but not the meaning — where do I start?",
  "I'm struggling to articulate my central conflict",
  "What questions should I be asking about my premise?",
  "Help me think through my story's themes",
];

interface Props {
  session: AISession;
}

export default function StoryIdentityWorkshopMode({ session }: Props) {
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
    <AIModeWrapper
      session={session}
      state={state}
      icon={Map}
      title="Story Identity Workshop"
    >
      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <Map size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Story Identity Workshop</p>
          <p className={styles.emptyHint}>
            {storyId
              ? "A guide to help you articulate what your story is and why it exists. The AI asks questions — you do the writing."
              : "Add a story to context to begin."}
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
          isStreaming={session.isStreaming}
          emptyText="Tell me about your story and I'll ask questions to help you think it through."
        />
      )}

      <ChatInput
        value={state.input}
        onChange={state.setInput}
        onSend={() => handleSend()}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming || !storyId}
        placeholder={session.messages.length > 0 ? "Continue the conversation…" : "What are you trying to work out?"}
      />
    </AIModeWrapper>
  );
}
