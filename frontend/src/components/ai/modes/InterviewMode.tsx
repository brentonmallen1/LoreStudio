import { useState, useRef, useEffect } from "react";
import {
  User2, BookOpen, RefreshCw, Sparkles, ChevronDown, ChevronUp,
  Database, Settings2, Brain
} from "lucide-react";
import { api } from "../../../api/client";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import type { CharacterJourney, LLMParams } from "../../../types";
import { useLLMStream } from "../../../hooks/useLLMStream";
import { useLLMTransparency } from "../../../hooks/useLLMTransparency";
import { useLLMContextSources } from "../../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources, ChatSettingsModal } from "../../llm";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./InterviewMode.module.css";

const CTX_LIMIT = 128_000;

function flattenNodes(nodes: import("../../../types").StructureNode[], depth = 0): Array<{ id: string; label: string; depth: number }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.title || "(untitled)", depth },
    ...flattenNodes(n.children ?? [], depth + 1),
  ]);
}

interface Props {
  session: AISession;
}

export default function InterviewMode({ session }: Props) {
  const { sendMessage, setInterviewNotes, updateSessionContext } = useAIStore();
  const { structure, characters, upsertCharacter } = useStoryStore();
  const [input, setInput] = useState("");
  const [showNotes, setShowNotes] = useState(!!(session.interviewNotes));
  const [showApply, setShowApply] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();
  const [journey, setJourney] = useState<CharacterJourney | null>(null);

  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const lastContextType = useRef<"interview" | "interview-summary">("interview");
  const transparency = useLLMTransparency();

  const character = characters.find((c) => c.id === session.context.characterId);
  const contextNodeId = session.context.nodeId ?? null;

  const estimatedTokens = Math.round(session.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const ctxPct = Math.min(Math.round((estimatedTokens / CTX_LIMIT) * 100), 100);
  const ctxWarning = ctxPct >= 80 ? "exceeded" : ctxPct >= 60 ? "approaching" : "normal";

  const flatNodes = flattenNodes(structure);

  const { sources: contextSources, loading: sourcesLoading } = useLLMContextSources(
    session.backendSessionId ? { context_type: "interview", interview_id: session.backendSessionId } : null
  );

  const { stream: streamSummary, text: summaryStreamText, isStreaming: isSummarizing } = useLLMStream({
    requestId: `interview-summary:${session.backendSessionId ?? session.id}`,
    label: "Summarizing interview",
    tabId: "characters",
    onComplete: async (full) => {
      lastResponse.current = full;
      transparency.recordInteraction();
      setInterviewNotes(session.id, full);
    },
  });

  const { stream: streamJourneyRefresh, isStreaming: refreshingJourney } = useLLMStream({
    requestId: `journey-refresh:${session.context.characterId ?? ""}:${contextNodeId ?? ""}`,
    label: "Refreshing journey context",
    tabId: "characters",
    onComplete: () => {
      if (session.context.characterId && contextNodeId) {
        api.getCharacterJourney(session.context.characterId, contextNodeId).then(setJourney).catch(() => {});
      }
    },
  });

  // Load journey when context changes
  useEffect(() => {
    setJourney(null);
    if (session.context.characterId && contextNodeId) {
      api.getCharacterJourney(session.context.characterId, contextNodeId)
        .then(setJourney)
        .catch(() => {});
    }
  }, [session.context.characterId, contextNodeId]);

  function handleSend() {
    if (!input.trim() || session.isStreaming) return;
    lastUserMsg.current = input.trim();
    lastContextType.current = "interview";
    sendMessage(session.id, input.trim(), undefined, sessionParams);
    setInput("");
  }

  async function captureInsights() {
    if (!session.backendSessionId || isSummarizing || session.messages.length === 0) return;
    lastContextType.current = "interview-summary";
    lastUserMsg.current = "Please summarize this interview.";
    setShowNotes(true);
    streamSummary((signal) => api.summarizeInterview(session.backendSessionId!, signal));
  }

  async function applyToCharacter(fields: string[]) {
    if (!session.backendSessionId || !character) return;
    const summaryText = session.interviewNotes ?? "";
    if (!summaryText) return;
    const content: Record<string, string> = {};
    for (const f of fields) {
      const existing = (character as unknown as Record<string, string>)[f] ?? "";
      content[f] = existing
        ? `${existing}\n\n[From interview ${new Date().toLocaleDateString()}]:\n${summaryText}`
        : summaryText;
    }
    const updated = await api.applyInterviewToCharacter(session.backendSessionId, fields, content);
    upsertCharacter(updated);
    setShowApply(false);
  }

  const summaryText = isSummarizing ? summaryStreamText : (session.interviewNotes ?? "");

  const staleIndicatorClass = !journey?.summary
    ? styles.journeyDotNone
    : journey.is_stale
    ? styles.journeyDotStale
    : styles.journeyDotFresh;

  return (
    <>
      <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
      <ChatSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onApply={setSessionParams}
        sessionParams={sessionParams}
      />

      {/* ── Sub-header: character + context ── */}
      <div className={styles.subHeader}>
        <div className={styles.avatar}>
          <User2 size={12} />
        </div>
        <div className={styles.meta}>
          <p className={styles.name}>{character?.name ?? session.resolvedNames.characterName ?? "Character"}</p>
          <p className={styles.modeLabel}>Interview session</p>
        </div>

        {/* Context token badge */}
        {session.messages.length > 0 && (
          <div
            className={styles.ctxBadge}
            data-warning={ctxWarning}
            title={`~${estimatedTokens.toLocaleString()} / ${CTX_LIMIT.toLocaleString()} tokens`}
          >
            <Database size={10} />
            {ctxPct}%
          </div>
        )}

        <LLMTransparencyTrigger
          disabled={!transparency.hasData}
          onClick={() => session.backendSessionId && transparency.open(
            { context_type: lastContextType.current, interview_id: session.backendSessionId, user_message: lastUserMsg.current },
            lastResponse.current,
          )}
        />
        <button
          className={`${styles.headerBtn} ${sessionParams ? styles.headerBtnActive : ""}`}
          onClick={() => setShowSettings(true)}
          title="AI parameters"
        >
          <Settings2 size={14} />
        </button>
      </div>

      {/* ── Story context selector ── */}
      <div className={styles.contextBar}>
        <BookOpen size={11} className={styles.contextIcon} />
        {!session.contextLocked ? (
          <select
            className={styles.contextSelect}
            value={contextNodeId ?? ""}
            onChange={(e) => {
              updateSessionContext(session.id, { nodeId: e.target.value || undefined });
            }}
          >
            <option value="">Timeless — no story context</option>
            {flatNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {"  ".repeat(n.depth)}{n.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.contextLabel}>
            {contextNodeId
              ? (flatNodes.find((n) => n.id === contextNodeId)?.label ?? "story context")
              : "Timeless interview"}
          </span>
        )}

        {contextNodeId && (
          <>
            <span className={staleIndicatorClass} title={
              !journey?.summary ? "No journey context" : journey.is_stale ? "May be outdated" : "Fresh"
            } />
            {journey?.is_stale && <span className={styles.staleTag}>Outdated</span>}
            <button
              className={styles.refreshBtn}
              onClick={() => {
                if (session.context.characterId && contextNodeId) {
                  streamJourneyRefresh((signal) =>
                    api.refreshCharacterJourney(session.context.characterId!, contextNodeId, signal)
                  );
                }
              }}
              disabled={refreshingJourney}
              title="Refresh journey context"
            >
              <RefreshCw size={10} className={refreshingJourney ? styles.spinning : ""} />
              {refreshingJourney ? "Refreshing…" : "Refresh"}
            </button>
          </>
        )}
      </div>

      <LLMContextSources sources={contextSources} loading={sourcesLoading && !contextSources.length} />

      {/* ── Suggested prompts (empty state) ── */}
      {session.messages.length === 0 && character?.interview_prompts && character.interview_prompts.length > 0 && (
        <div className={styles.prompts}>
          <p className={styles.promptsLabel}>Suggested questions</p>
          <div className={styles.promptList}>
            {character.interview_prompts.slice(0, 3).map((prompt, i) => (
              <button key={i} className={styles.promptBtn} onClick={() => setInput(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <MessageList
        messages={session.messages}
        streamingText={session.streamingText}
        isStreaming={session.isStreaming}
        emptyText="Start the interview by saying hello or asking a question."
      />

      {/* ── Captured insights ── */}
      {showNotes && (
        <div className={styles.notesArea}>
          <div className={styles.notesHeader}>
            <span className={styles.notesLabel}>
              <Brain size={11} />
              Captured Insights
            </span>
            <div className={styles.notesActions}>
              {summaryText && !isSummarizing && (
                <button className={styles.applyBtn} onClick={() => setShowApply((v) => !v)}>
                  Apply to character…
                </button>
              )}
              <button className={styles.notesToggle} onClick={() => setShowNotes(false)}>
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <div className={styles.notesText}>
            {isSummarizing && !summaryText
              ? <span className={styles.summarizing}>Analyzing interview…</span>
              : summaryText}
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

      {/* ── Input ── */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={session.isStreaming}
        placeholder="Ask a question…"
        hintLeft={<span>Shift+Enter for newline</span>}
        hintRight={
          session.messages.length > 0 ? (
            <button
              className={styles.captureBtn}
              onClick={showNotes ? () => setShowNotes(true) : captureInsights}
              disabled={isSummarizing || session.messages.length === 0}
            >
              {showNotes ? <ChevronUp size={11} /> : <Sparkles size={11} />}
              {isSummarizing ? "Analyzing…" : showNotes ? "Show notes" : "Capture insights"}
            </button>
          ) : null
        }
      />
    </>
  );
}
