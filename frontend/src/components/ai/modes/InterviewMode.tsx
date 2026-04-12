import { useState, useRef, useEffect } from "react";
import {
  User2, BookOpen, RefreshCw, Feather, ChevronDown, ChevronUp, Brain, Scissors, Archive
} from "lucide-react";
import { api } from "../../../api/client";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import type { CharacterJourney } from "../../../types";
import { useLLMStream } from "../../../hooks/useLLMStream";
import { useLLMContextSources } from "../../../hooks/useLLMContextSources";
import { LLMContextSources } from "../../llm";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./InterviewMode.module.css";

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
  const state = useAIModeState(session);
  const { sendMessage, setInterviewNotes, updateSessionContext, cancelStreaming } = useAIStore();
  const { structure, characters, upsertCharacter } = useStoryStore();
  const [showNotes, setShowNotes] = useState(!!(session.interviewNotes));
  const [showApply, setShowApply] = useState(false);
  const [journey, setJourney] = useState<CharacterJourney | null>(null);
  const [isCompacting, setIsCompacting] = useState(false);
  const [compactionCount, setCompactionCount] = useState<number>(0);

  // Sync compaction_count from interview data
  useEffect(() => {
    if (session.backendSessionId) {
      api.getInterview(session.backendSessionId)
        .then((iv) => setCompactionCount(iv.compaction_count ?? 0))
        .catch(() => {});
    }
  }, [session.backendSessionId]);

  const lastContextType = useRef<"interview" | "interview-summary">("interview");

  const character = characters.find((c) => c.id === session.context.characterId);
  const contextNodeId = session.context.nodeId ?? null;
  const flatNodes = flattenNodes(structure);

  const { sources: contextSources, loading: sourcesLoading } = useLLMContextSources(
    session.backendSessionId ? { context_type: "interview", interview_id: session.backendSessionId } : null
  );

  const { stream: streamSummary, text: summaryStreamText, isStreaming: isSummarizing } = useLLMStream({
    requestId: `interview-summary:${session.backendSessionId ?? session.id}`,
    label: "Summarizing interview",
    tabId: "characters",
    onComplete: async (full) => {
      state.lastResponse.current = full;
      state.transparency.recordInteraction();
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

  useEffect(() => {
    setJourney(null);
    if (session.context.characterId && contextNodeId) {
      api.getCharacterJourney(session.context.characterId, contextNodeId)
        .then(setJourney)
        .catch(() => {});
    }
  }, [session.context.characterId, contextNodeId]);

  function handleSend() {
    if (!state.input.trim() || session.isStreaming) return;
    state.lastUserMsg.current = state.input.trim();
    lastContextType.current = "interview";
    sendMessage(session.id, state.input.trim(), undefined, state.sessionParams);
    state.setInput("");
  }

  async function captureInsights() {
    if (!session.backendSessionId || isSummarizing || session.messages.length === 0) return;
    lastContextType.current = "interview-summary";
    state.lastUserMsg.current = "Please summarize this interview.";
    setShowNotes(true);
    streamSummary((signal) => api.summarizeInterview(session.backendSessionId!, signal));
  }

  async function handleCompact() {
    if (!session.backendSessionId || isCompacting) return;
    setIsCompacting(true);
    try {
      const updated = await api.compactInterview(session.backendSessionId);
      setCompactionCount(updated.compaction_count ?? 0);
    } catch {
      // ignore
    } finally {
      setIsCompacting(false);
    }
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
    <AIModeWrapper
      session={session}
      state={state}
      icon={User2}
      title="Interview"
      hideTitle
      onTransparencyClick={() => session.backendSessionId && state.transparency.open(
        { context_type: lastContextType.current, interview_id: session.backendSessionId, user_message: state.lastUserMsg.current },
        state.lastResponse.current,
      )}
      headerExtra={
        <>
          <div className={styles.avatar}><User2 size={12} /></div>
          <div className={styles.meta}>
            <p className={styles.name}>{character?.name ?? session.resolvedNames.characterName ?? "Character"}</p>
            <p className={styles.modeLabel}>Interview session</p>
          </div>
        </>
      }
      contextBar={
        <>
          <div className={styles.contextBar}>
            <BookOpen size={11} className={styles.contextIcon} />
            {!session.contextLocked ? (
              <select
                className={styles.contextSelect}
                value={contextNodeId ?? ""}
                onChange={(e) => updateSessionContext(session.id, { nodeId: e.target.value || undefined })}
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
        </>
      }
    >
      {/* ── Suggested prompts (empty state) ── */}
      {session.messages.length === 0 && character?.interview_prompts && character.interview_prompts.length > 0 && (
        <div className={styles.prompts}>
          <p className={styles.promptsLabel}>Suggested questions</p>
          <div className={styles.promptList}>
            {character.interview_prompts.slice(0, 3).map((prompt, i) => (
              <button key={i} className={styles.promptBtn} onClick={() => state.setInput(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <MessageList
        messages={session.messages}
        streamingText={session.streamingText}
        isStreaming={session.isStreaming}
        emptyText="Start the interview by saying hello or asking a question."
      />

      {/* ── Compaction bar ── */}
      {state.ctxWarning !== "normal" && session.messages.length >= 10 && (
        <div className={styles.compactBar}>
          {compactionCount > 0 && (
            <span className={styles.compactedBadge} title="History has been compacted to free context space">
              <Archive size={10} /> {compactionCount}× compacted
            </span>
          )}
          <button
            className={styles.compactBtn}
            onClick={handleCompact}
            disabled={isCompacting}
            title="Summarize older messages to free up context space"
          >
            <Scissors size={12} />
            {isCompacting ? "Compacting…" : "Compact history"}
          </button>
        </div>
      )}
      {compactionCount > 0 && state.ctxWarning === "normal" && (
        <div className={styles.compactBar}>
          <span className={styles.compactedBadge} title="History has been compacted">
            <Archive size={10} /> {compactionCount}× compacted
          </span>
        </div>
      )}

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

      <ChatInput
        value={state.input}
        onChange={state.setInput}
        onSend={handleSend}
        onCancel={() => cancelStreaming(session.id)}
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
              {showNotes ? <ChevronUp size={11} /> : <Feather size={11} />}
              {isSummarizing ? "Analyzing…" : showNotes ? "Show notes" : "Capture insights"}
            </button>
          ) : null
        }
      />
    </AIModeWrapper>
  );
}
