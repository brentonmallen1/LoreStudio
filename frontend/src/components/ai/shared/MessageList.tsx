import { useRef, useEffect } from "react";
import { Brain, Layers } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../../types";
import styles from "./MessageList.module.css";

const THINKING_RE = /<\|channel>thought\n([\s\S]*?)<channel\|>/g;

function MessageContent({ content }: { content: string }) {
  const thinkingBlocks: string[] = [];
  const mainContent = content.replace(THINKING_RE, (_, thought) => {
    thinkingBlocks.push(thought.trim());
    return "";
  }).trim();

  return (
    <>
      {thinkingBlocks.length > 0 && (
        <details className={styles.thinkingBlock}>
          <summary className={styles.thinkingSummary}>
            <Brain size={11} />
            Thinking
          </summary>
          <div className={styles.thinkingContent}>{thinkingBlocks.join("\n\n")}</div>
        </details>
      )}
      <div className={styles.markdown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {mainContent}
        </ReactMarkdown>
      </div>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  // true = user is at (or near) the bottom and wants auto-scroll
  const pinToBottom = useRef(true);
  // ignore scroll events caused by our own scrollIntoView
  const isAutoScrolling = useRef(false);

  function isNearBottom() {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function handleScroll() {
    if (isAutoScrolling.current) return;
    pinToBottom.current = isNearBottom();
  }

  function scrollToBottom() {
    isAutoScrolling.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // smooth scroll takes ~300ms; reset flag after
    setTimeout(() => { isAutoScrolling.current = false; }, 350);
  }

  // During streaming: only scroll if pinned
  useEffect(() => {
    if (pinToBottom.current) {
      scrollToBottom();
    }
  }, [streamingText]);

  // New messages (user sent or stream finalized): always scroll and re-pin
  useEffect(() => {
    pinToBottom.current = true;
    scrollToBottom();
  }, [messages.length]);

  return (
    <div className={styles.messages} ref={scrollRef} onScroll={handleScroll}>
      {messages.length === 0 && !isStreaming && (
        <p className={styles.empty}>
          {emptyText ?? "Start the conversation by sending a message."}
        </p>
      )}
      {messages.map((msg, i) => {
        if (msg.isSummary) {
          return (
            <details key={i} className={styles.summaryBlock}>
              <summary className={styles.summarySummary}>
                <Layers size={11} />
                Conversation summary
              </summary>
              <div className={styles.summaryContent}>{msg.content}</div>
            </details>
          );
        }
        return (
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
        );
      })}
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
