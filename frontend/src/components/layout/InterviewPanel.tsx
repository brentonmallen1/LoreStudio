import { useState, useRef, useEffect } from "react";
import { X, Minus, Send, User2, Sparkles, ChevronDown, ChevronUp, RefreshCw, BookOpen } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import type { InterviewMessage, CharacterJourney } from "../../types";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources } from "../llm";
import styles from "./InterviewPanel.module.css";

export default function InterviewPanel() {
  const { activeInterview, activeInterviewCharacter, closeInterviewPanel, collapseInterviewPanel, setActiveInterview } =
    useUIStore();
  const { upsertCharacter, structure } = useStoryStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<InterviewMessage[]>(activeInterview?.messages ?? []);
  const [showNotes, setShowNotes] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [journey, setJourney] = useState<CharacterJourney | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const lastContextType = useRef<"interview" | "interview-summary">("interview");
  const transparency = useLLMTransparency();

  const interviewId = activeInterview?.id ?? "";
  const character = activeInterviewCharacter;

  function findNodeTitle(nodeId: string, nodes: import("../../types").StructureNode[]): string | null {
    for (const n of nodes) {
      if (n.id === nodeId) return n.title;
      const found = findNodeTitle(nodeId, n.children);
      if (found) return found;
    }
    return null;
  }

  const { sources: contextSources, loading: sourcesLoading } = useLLMContextSources(
    interviewId ? { context_type: "interview", interview_id: interviewId } : null
  );

  const { stream: streamChat, text: chatStreamText, isStreaming } = useLLMStream({
    requestId: `interview:${interviewId}`,
    label: `Interview with ${character?.name ?? "character"}`,
    onComplete: async (full) => {
      lastResponse.current = full;
      transparency.recordInteraction();
      if (activeInterview) {
        const updated = await api.getInterview(activeInterview.id);
        setActiveInterview(updated);
        setMessages(updated.messages);
      }
      inputRef.current?.focus();
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠ Error reaching LLM.", timestamp: new Date().toISOString() },
      ]);
    },
  });

  const { stream: streamSummary, text: summaryStreamText, isStreaming: isSummarizing } = useLLMStream({
    requestId: `interview-summary:${interviewId}`,
    label: "Summarizing interview",
    onComplete: async (full) => {
      lastResponse.current = full;
      transparency.recordInteraction();
      if (activeInterview) {
        const updated = await api.getInterview(activeInterview.id);
        setActiveInterview(updated);
      }
    },
  });

  const contextNodeId = activeInterview?.context_node_id ?? null;

  const { stream: streamJourneyRefresh, isStreaming: refreshingJourney } = useLLMStream({
    requestId: `journey-refresh:${activeInterviewCharacter?.id ?? ""}:${contextNodeId ?? ""}`,
    label: "Refreshing journey context",
    onComplete: () => {
      if (activeInterviewCharacter && contextNodeId) {
        api.getCharacterJourney(activeInterviewCharacter.id, contextNodeId).then(setJourney).catch(() => {});
      }
    },
  });

  const summaryText = isSummarizing
    ? summaryStreamText
    : (activeInterview?.interview_notes ?? "");

  useEffect(() => {
    setMessages(activeInterview?.messages ?? []);
    setShowNotes(!!(activeInterview?.interview_notes));
    setJourney(null);
    if (activeInterview?.context_node_id && activeInterviewCharacter) {
      api.getCharacterJourney(activeInterviewCharacter.id, activeInterview.context_node_id)
        .then(setJourney)
        .catch(() => {});
    }
  }, [activeInterview?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatStreamText]);

  async function sendMessage() {
    if (!input.trim() || isStreaming || !activeInterview) return;
    const content = input.trim();
    lastUserMsg.current = content;
    lastContextType.current = "interview";
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content, timestamp: new Date().toISOString() }]);
    streamChat((signal) => api.sendInterviewMessage(activeInterview.id, content, signal));
  }

  async function captureInsights() {
    if (!activeInterview || isSummarizing || messages.length === 0) return;
    lastContextType.current = "interview-summary";
    lastUserMsg.current = "Please summarize this interview.";
    setShowNotes(true);
    streamSummary((signal) => api.summarizeInterview(activeInterview.id, signal));
  }

  async function applyToCharacter(fields: string[]) {
    if (!activeInterview || !activeInterviewCharacter || !summaryText) return;
    const content: Record<string, string> = {};
    const char = activeInterviewCharacter;
    for (const f of fields) {
      const existing = (char as Record<string, unknown>)[f] as string ?? "";
      content[f] = existing ? `${existing}\n\n[From interview ${new Date().toLocaleDateString()}]:\n${summaryText}` : summaryText;
    }
    const updated = await api.applyInterviewToCharacter(activeInterview.id, fields, content);
    upsertCharacter(updated);
    setShowApply(false);
  }

  return (
    <>
    <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          <User2 size={12} />
        </div>
        <div className={styles.meta}>
          <p className={styles.characterName}>{character?.name ?? "Character"}</p>
          <p className={styles.sessionLabel}>Interview session</p>
        </div>
        <LLMTransparencyTrigger
          disabled={!transparency.hasData}
          onClick={() => activeInterview && transparency.open(
            { context_type: lastContextType.current, interview_id: activeInterview.id, user_message: lastUserMsg.current },
            lastResponse.current,
          )}
        />
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

      <LLMContextSources sources={contextSources} loading={sourcesLoading && !contextSources.length} />

      {contextNodeId && (
        <div className={styles.contextBar}>
          <BookOpen size={11} className={styles.contextBarIcon} />
          <span className={styles.contextBarLabel}>
            At: {findNodeTitle(contextNodeId, structure) ?? "scene"}
          </span>
          <span className={
            !journey || !journey.summary
              ? styles.journeyDotNone
              : journey.is_stale
              ? styles.journeyDotStale
              : styles.journeyDotFresh
          } title={
            !journey || !journey.summary ? "No journey context" : journey.is_stale ? "Context may be outdated" : "Context is fresh"
          } />
          {journey?.is_stale && (
            <span className={styles.staleTag}>Outdated</span>
          )}
          <button
            className={styles.refreshContextBtn}
            onClick={() => {
              if (activeInterviewCharacter && contextNodeId) {
                streamJourneyRefresh((signal) =>
                  api.refreshCharacterJourney(activeInterviewCharacter.id, contextNodeId, signal)
                );
              }
            }}
            disabled={refreshingJourney}
            title="Refresh journey context"
          >
            <RefreshCw size={10} className={refreshingJourney ? styles.spinning : ""} />
            {refreshingJourney ? "Refreshing…" : "Refresh context"}
          </button>
        </div>
      )}

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
        {chatStreamText && (
          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={`${styles.bubble} ${styles.assistantBubble}`}>{chatStreamText}</div>
          </div>
        )}
        {isStreaming && !chatStreamText && (
          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={styles.typing}>…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Insights notes ── */}
      {showNotes && (
        <div className={styles.notesArea}>
          <div className={styles.notesHeader}>
            <span className={styles.notesLabel}>Captured Insights</span>
            <div className={styles.notesActions}>
              {summaryText && !isSummarizing && (
                <button
                  className={styles.applyBtn}
                  onClick={() => setShowApply((s) => !s)}
                  title="Apply insights to character"
                >
                  Apply to character…
                </button>
              )}
              <button className={styles.notesToggle} onClick={() => setShowNotes(false)} title="Hide notes">
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <div className={styles.notesText}>
            {isSummarizing && !summaryText ? <span className={styles.summarizing}>Analyzing interview…</span> : summaryText}
          </div>
          {showApply && (
            <div className={styles.applyPanel}>
              <p className={styles.applyLabel}>Apply notes to which fields?</p>
              {(["arc_notes", "background", "motivation", "personality"] as const).map((f) => (
                <button key={f} className={styles.applyField} onClick={() => applyToCharacter([f])}>
                  {f.replace("_", " ")} →
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className={styles.sendBtn}
          >
            <Send size={14} />
          </button>
        </div>
        <div className={styles.hintRow}>
          <p className={styles.hint}>Shift+Enter for newline</p>
          {messages.length > 0 && (
            <button
              className={styles.captureBtn}
              onClick={showNotes ? () => setShowNotes(true) : captureInsights}
              disabled={isSummarizing || messages.length === 0}
              title="Capture insights from this interview"
            >
              {showNotes ? <ChevronUp size={11} /> : <Sparkles size={11} />}
              {isSummarizing ? "Analyzing…" : showNotes ? "Show notes" : "Capture insights"}
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
