import { useState, useRef, useEffect } from "react";
import { X, Minus, Send, User2 } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import type { InterviewMessage } from "../../types";
import styles from "./InterviewPanel.module.css";

export default function InterviewPanel() {
  const { activeInterview, activeInterviewCharacter, closeInterviewPanel, collapseInterviewPanel, setActiveInterview } =
    useUIStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<InterviewMessage[]>(activeInterview?.messages ?? []);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(activeInterview?.messages ?? []);
  }, [activeInterview?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || streaming || !activeInterview) return;
    const content = input.trim();
    setInput("");
    setStreaming(true);

    const userMsg: InterviewMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.sendInterviewMessage(activeInterview.id, content);
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const assistantMsg: InterviewMessage = {
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg, content: full };
          return updated;
        });
      }

      const updated = await api.getInterview(activeInterview.id);
      setActiveInterview(updated);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠ Error reaching LLM.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  const character = activeInterviewCharacter;

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          <User2 size={12} />
        </div>
        <div className={styles.meta}>
          <p className={styles.characterName}>{character?.name ?? "Character"}</p>
          <p className={styles.sessionLabel}>Interview session</p>
        </div>
        <button
          onClick={collapseInterviewPanel}
          className={styles.panelBtn}
          title="Collapse (keep session)"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={closeInterviewPanel}
          className={styles.panelBtn}
          title="Close interview"
        >
          <X size={14} />
        </button>
      </div>

      {messages.length === 0 && character?.interview_prompts && character.interview_prompts.length > 0 && (
        <div className={styles.prompts}>
          <p className={styles.promptsLabel}>Suggested questions</p>
          <div className={styles.promptList}>
            {character.interview_prompts.slice(0, 3).map((prompt, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(prompt);
                  inputRef.current?.focus();
                }}
                className={styles.promptBtn}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.emptyMessages}>
            Start the interview by saying hello or asking a question.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.messageRow} ${msg.role === "user" ? styles.user : styles.assistant}`}
          >
            <div
              className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.assistantBubble}`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={styles.typing}>…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask a question…"
            rows={1}
            className={styles.textarea}
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className={styles.sendBtn}
          >
            <Send size={14} />
          </button>
        </div>
        <p className={styles.hint}>Shift+Enter for newline</p>
      </div>
    </aside>
  );
}
