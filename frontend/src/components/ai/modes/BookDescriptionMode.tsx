import { Feather } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import MentionComposer from "../shared/MentionComposer";
import styles from "./AssistantMode.module.css";

const STARTERS = [
  "Draft a dramatic, high-stakes description",
  "Write a literary, character-focused description",
  "Make it feel mysterious and intriguing",
  "Write something short and punchy — under 100 words",
  "Focus on the central conflict and stakes",
];

interface Props {
  session: AISession;
}

export default function BookDescriptionMode({ session }: Props) {
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
    <AIModeWrapper session={session} state={state} icon={Feather} title="Book Description">
      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <Feather size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Book Jacket Copy</p>
          <p className={styles.emptyHint}>
            {storyId
              ? "Draft and refine back-cover copy — hook, body paragraph, and tagline. Tell me what tone you're going for, or pick a style below."
              : "Add a story to context to draft book jacket copy."}
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
          streamingThinking={session.streamingThinking}
          isStreaming={session.isStreaming}
          emptyText="Tell me what tone you want for the description."
        />
      )}

      <MentionComposer
        sessionId={session.id}
        value={state.input}
        onChange={state.setInput}
        onSend={() => handleSend()}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming || !storyId}
        placeholder={session.messages.length > 0 ? "Refine the copy…" : "Describe the tone you want…"}
      />
    </AIModeWrapper>
  );
}
