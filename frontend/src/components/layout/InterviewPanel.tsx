import { useState, useRef, useEffect } from "react";
import { X, Minus, Send, User2, Sparkles, ChevronDown, ChevronUp, RefreshCw, BookOpen, Settings2, Brain } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import type { InterviewMessage, CharacterJourney, LLMParams } from "../../types";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources, ChatSettingsModal } from "../llm";
import styles from "./InterviewPanel.module.css";

const THINKING_RE = /<\|channel>thought\n([\s\S]*?)<channel\|>/g;

function MessageContent({ content, styles: s }: { content: string; styles: Record<string, string> }) {
  const thinkingBlocks: string[] = [];
  const mainContent = content.replace(THINKING_RE, (_, thought) => {
    thinkingBlocks.push(thought.trim());
    return "";
  }).trim();

  if (thinkingBlocks.length === 0) return <>{content}</>;

  return (
    <>
      <details className={s.thinkingBlock}>
        <summary className={s.thinkingSummary}>
          <Brain size={11} />
          Thinking
        </summary>
        <div className={s.thinkingContent}>{thinkingBlocks.join("\n\n")}</div>
      </details>
      {mainContent}
    </>
  );
}

export default function InterviewPanel() {
  const { activeInterview, activeInterviewCharacter, closeInterviewPanel, collapseInterviewPanel, setActiveInterview } =
    useUIStore();
  const { upsertCharacter, structure, activeStory } = useStoryStore();
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
  const chronicleSessionId = useRef<string | null>(null);
  const pendingSessionData = useRef<{ story_id: string; context_type: string; context_id: string; context_label: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();

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
    tabId: "characters",
    onComplete: async (full) => {
      lastResponse.current = full;
      transparency.recordInteraction();
      persistToChronicle("assistant", full);
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
    tabId: "characters",
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
    tabId: "characters",
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
    chronicleSessionId.current = null;
    pendingSessionData.current = null;
    if (activeInterview?.context_node_id && activeInterviewCharacter) {
      api.getCharacterJourney(activeInterviewCharacter.id, activeInterview.context_node_id)
        .then(setJourney)
        .catch(() => {});
    }
    // Store session data for lazy creation on first message
    if (activeInterview && activeInterviewCharacter && activeStory) {
      pendingSessionData.current = {
        story_id: activeStory.id,
        context_type: "character",
        context_id: activeInterviewCharacter.id,
        context_label: activeInterviewCharacter.name,
      };
    }
  }, [activeInterview?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatStreamText]);

  async function persistToChronicle(role: string, content: string) {
    if (!chronicleSessionId.current) {
      if (!pendingSessionData.current) return;
      const session = await api.createChronicleSession(pendingSessionData.current).catch(() => null);
      if (!session) return;
      chronicleSessionId.current = session.id;
      pendingSessionData.current = null;
    }
    api.addChronicleMessage(chronicleSessionId.current, { role, content }).catch(() => {});
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming || !activeInterview) return;
    const content = input.trim();
    lastUserMsg.current = content;
    lastContextType.current = "interview";
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content, timestamp: new Date().toISOString() }]);
    persistToChronicle("user", content);
    streamChat((signal) => api.sendInterviewMessage(activeInterview.id, content, signal, sessionParams));
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
      const existing = (char as unknown as Record<string, string>)[f] ?? "";
      content[f] = existing ? `${existing}\n\n[From interview ${new Date().toLocaleDateString()}]:\n${summaryText}` : summaryText;
    }
    const updated = await api.applyInterviewToCharacter(activeInterview.id, fields, content);
    upsertCharacter(updated);
    setShowApply(false);
  }

  return (
    <>
    <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
    <ChatSettingsModal
      isOpen={showSettings}
      onClose={() => setShowSettings(false)}
      onApply={setSessionParams}
      sessionParams={sessionParams}
    />
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
          onClick={() => setShowSettings(true)}
          className={`${styles.panelBtn} ${sessionParams ? styles.panelBtnActive : ""}`}
          title="AI parameters"
        >
          <Settings2 size={14} />
        </button>
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
              {msg.role === "assistant"
                ? <MessageContent content={msg.content} styles={styles} />
                : msg.content}
            </div>
          </div>
        ))}
        {isStreaming && chatStreamText && (
          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={`${styles.bubble} ${styles.assistantBubble}`}>
              <MessageContent content={chatStreamText} styles={styles} />
            </div>
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
