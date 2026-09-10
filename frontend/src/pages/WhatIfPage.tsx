import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Shuffle, Send, Square, RotateCcw, Feather, Brain } from "lucide-react";
import { api } from "../api/client";
import type { ChatMessage } from "../types";
import { useLLMStream } from "../hooks/useLLMStream";
import styles from "./WhatIfPage.module.css";

const EXAMPLE_PROMPTS = [
  "What if I killed the main antagonist in the first act?",
  "What if two characters swapped their roles?",
  "What if the inciting incident never happened?",
  "What if the protagonist failed at the midpoint?",
  "What if a supporting character was the real villain?",
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const mainContent = msg.content.trim();
  return (
    <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}>
      <div className={styles.bubbleLabel}>{isUser ? "You" : "Analyst"}</div>
      <div className={styles.bubbleText}>{mainContent}</div>
    </div>
  );
}

export default function WhatIfPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    stream,
    cancel,
    text: streamText,
    thinking: streamThinking,
    isStreaming,
  } = useLLMStream({
    requestId: `whatif:${storyId}`,
    label: "What If?",
    tabId: "story",
    onComplete: (full, thinking) => {
      setMessages((prev) => [...prev, { role: "assistant", content: full, thinking }]);
      inputRef.current?.focus();
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Analysis failed — check that Ollama is running]" },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isStreaming || !storyId) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    stream((signal) => api.sendWhatIfMessage(storyId, nextMessages, signal));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Shuffle size={15} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>What If?</h1>
            <p className={styles.subtitle}>
              Explore hypothetical changes — see the ripple effects across your story
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button className={styles.resetBtn} onClick={reset} title="Start over">
            <RotateCcw size={13} />
            New scenario
          </button>
        )}
      </div>

      {/* Messages */}
      <div className={styles.messageList}>
        {isEmpty ? (
          <div className={styles.emptyState}>
            <Feather size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Ask a "What if?" question</p>
            <p className={styles.emptyHint}>
              Explore how a single change could ripple through your characters, plot threads, and themes.
            </p>
            <div className={styles.examples}>
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} className={styles.exampleBtn} onClick={() => send(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {isStreaming && (streamText || streamThinking) && (
              <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleStreaming}`}>
                <div className={styles.bubbleLabel}>Analyst</div>
                {streamThinking && !streamText && (
                  <div className={styles.thinkingIndicator}>
                    <Brain size={11} />
                    Thinking…
                  </div>
                )}
                {streamText && <div className={styles.bubbleText}>{streamText.trim()}</div>}
              </div>
            )}
            {isStreaming && !streamText && !streamThinking && (
              <div className={styles.thinking}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputRow}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={messages.length > 0 ? "Ask a follow-up…" : "What if…"}
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button className={styles.stopBtn} onClick={cancel} title="Cancel">
            <Square size={14} />
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={() => send()}
            disabled={!input.trim()}
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
