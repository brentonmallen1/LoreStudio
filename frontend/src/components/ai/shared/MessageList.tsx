import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Brain, Check, Copy, Layers, RotateCw, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../../types";
import styles from "./MessageList.module.css";

/**
 * Reasoning arrives on its own event, so this component receives it as a field rather
 * than digging it back out of the prose with a regex over a half-arrived buffer.
 */
function MessageContent({ content, thinking }: { content: string; thinking?: string }) {
  const mainContent = content.trim();
  const reasoning = thinking?.trim();

  return (
    <>
      {reasoning && (
        <details className={styles.thinkingBlock}>
          <summary className={styles.thinkingSummary}>
            <Brain size={11} />
            Thinking
          </summary>
          <div className={styles.thinkingContent}>{reasoning}</div>
        </details>
      )}
      {reasoning && !mainContent && (
        <div className={styles.thinkingIndicator}>
          <Brain size={11} />
          Thinking…
        </div>
      )}
      {mainContent && (
        <div className={styles.markdown}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{mainContent}</ReactMarkdown>
        </div>
      )}
    </>
  );
}

interface Props {
  messages: ChatMessage[];
  streamingText?: string;
  /** Reasoning for the answer still arriving, shown while it does. */
  streamingThinking?: string;
  isStreaming: boolean;
  emptyText?: string;
  /** Re-run the last exchange. Shown on the final assistant message when set. */
  onRegenerate?: () => void;
  /** Open the call behind a reply — what was actually sent (doc 06 §9). */
  onShowCall?: () => void;
  /** Keep a reply as a Compendium note. */
  onSaveNote?: (content: string) => Promise<void> | void;
}

/** Per-message actions: an answer you can copy, question, or ask again (doc 06 §2.1). */
function MessageActions({
  content,
  onRegenerate,
  onShowCall,
  onSaveNote,
}: {
  content: string;
  onRegenerate?: () => void;
  onShowCall?: () => void;
  onSaveNote?: (content: string) => Promise<void> | void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className={styles.actions}>
      <button
        className={styles.action}
        title="Copy this reply"
        onClick={() => {
          navigator.clipboard?.writeText(content);
          setCopied(true);
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      {onShowCall && (
        <button
          className={styles.action}
          title="Show what was sent for this reply"
          onClick={onShowCall}
          aria-label="Show what was sent for this reply"
        >
          <ShieldCheck size={11} />
        </button>
      )}
      {onSaveNote && (
        <button
          className={styles.action}
          title={saved ? "Saved to the Compendium" : "Save to the Compendium"}
          onClick={async () => {
            await onSaveNote(content);
            setSaved(true);
          }}
        >
          {saved ? <Check size={11} /> : <BookmarkPlus size={11} />}
        </button>
      )}
      {onRegenerate && (
        <button className={styles.action} title="Ask again" onClick={onRegenerate} aria-label="Ask again">
          <RotateCw size={11} />
        </button>
      )}
    </div>
  );
}

export default function MessageList({
  messages,
  streamingText,
  streamingThinking,
  isStreaming,
  emptyText,
  onRegenerate,
  onShowCall,
  onSaveNote,
}: Props) {
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
    setTimeout(() => {
      isAutoScrolling.current = false;
    }, 350);
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
        <p className={styles.empty}>{emptyText ?? "Start the conversation by sending a message."}</p>
      )}
      {messages.map((msg, i) => {
        const isLastAssistant = msg.role === "assistant" && i === messages.length - 1 && !isStreaming;
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
            <div
              className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.assistantBubble}`}
            >
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
              {msg.role === "assistant" ? (
                <MessageContent content={msg.content} thinking={msg.thinking} />
              ) : (
                msg.content
              )}
              {msg.role === "assistant" && (
                <MessageActions
                  content={msg.content}
                  onShowCall={onShowCall}
                  onSaveNote={onSaveNote}
                  onRegenerate={isLastAssistant ? onRegenerate : undefined}
                />
              )}
            </div>
          </div>
        );
      })}
      {isStreaming && (streamingText || streamingThinking) && (
        <div className={`${styles.row} ${styles.assistantRow}`}>
          <div className={`${styles.bubble} ${styles.assistantBubble}`}>
            <MessageContent content={streamingText ?? ""} thinking={streamingThinking} />
          </div>
        </div>
      )}
      {isStreaming && !streamingText && !streamingThinking && (
        <div className={`${styles.row} ${styles.assistantRow}`}>
          <div className={styles.typing}>…</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
