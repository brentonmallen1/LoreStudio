import { useRef, useEffect } from "react";
import { Brain } from "lucide-react";
import type { ChatMessage } from "../../../types";
import styles from "./MessageList.module.css";

const THINKING_RE = /<\|channel>thought\n([\s\S]*?)<channel\|>/g;

function MessageContent({ content }: { content: string }) {
  const thinkingBlocks: string[] = [];
  const mainContent = content.replace(THINKING_RE, (_, thought) => {
    thinkingBlocks.push(thought.trim());
    return "";
  }).trim();

  if (thinkingBlocks.length === 0) return <>{content}</>;

  return (
    <>
      <details className={styles.thinkingBlock}>
        <summary className={styles.thinkingSummary}>
          <Brain size={11} />
          Thinking
        </summary>
        <div className={styles.thinkingContent}>{thinkingBlocks.join("\n\n")}</div>
      </details>
      {mainContent}
    </>
  );
}

interface Props {
  messages: ChatMessage[];
  streamingText?: string;
  isStreaming: boolean;
  emptyText?: string;
}

export default function MessageList({ messages, streamingText, isStreaming, emptyText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  return (
    <div className={styles.messages}>
      {messages.length === 0 && !isStreaming && (
        <p className={styles.empty}>
          {emptyText ?? "Start the conversation by sending a message."}
        </p>
      )}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`${styles.row} ${msg.role === "user" ? styles.userRow : styles.assistantRow}`}
        >
          <div className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
            {msg.images?.length ? (
              <div className={styles.imageList}>
                {msg.images.map((b64, idx) => (
                  <img
                    key={idx}
                    src={`data:image/jpeg;base64,${b64}`}
                    alt="attached"
                    className={styles.image}
                  />
                ))}
              </div>
            ) : null}
            {msg.role === "assistant"
              ? <MessageContent content={msg.content} />
              : msg.content}
          </div>
        </div>
      ))}
      {isStreaming && streamingText && (
        <div className={`${styles.row} ${styles.assistantRow}`}>
          <div className={`${styles.bubble} ${styles.assistantBubble}`}>
            <MessageContent content={streamingText} />
          </div>
        </div>
      )}
      {isStreaming && !streamingText && (
        <div className={`${styles.row} ${styles.assistantRow}`}>
          <div className={styles.typing}>…</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
